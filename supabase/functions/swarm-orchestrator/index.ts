// swarm-orchestrator
// Wird in den Harvest-Minuten von reminder-tick aufgerufen.
// Aufgabe: aktiv-spendende User identifizieren, Jobs zuweisen.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isHarvestWindow, isMonthlyHarvestDay, detectLlmProvider, PROVIDERS, probeLlmRemaining } from "../_shared/providerLimits.ts";
import { JOBS, statusAfterJob, nextJobType } from "../_shared/swarmJobs.ts";

const ACTIVATION_THRESHOLD = 10;       // Schwarm-Schwelle
const MAX_JOBS_PER_USER_PER_DAY = 3;
const MAX_PIPELINE_PARALLEL = 20;
const MAX_JOBS_PER_DAY_PLATFORM = 1000;

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Aktivierungs-Gate: 10+ User mit donate_tokens=true?
  const { count: activeCount } = await supabase
    .from("profiles").select("id", { count: "exact", head: true })
    .eq("donate_tokens", true);
  if ((activeCount ?? 0) < ACTIVATION_THRESHOLD) {
    return json({ skipped: 'below_threshold', activeCount });
  }

  // 2. Tages-Cap Plattform
  const today = new Date().toISOString().slice(0, 10);
  const { count: jobsToday } = await supabase
    .from("article_jobs").select("id", { count: "exact", head: true })
    .gte("created_at", `${today}T00:00:00Z`);
  if ((jobsToday ?? 0) >= MAX_JOBS_PER_DAY_PLATFORM) {
    return json({ skipped: 'daily_cap', jobsToday });
  }

  // 3. Backpressure: zu viele Artikel in der Pipeline?
  const { count: unfinishedArticles } = await supabase
    .from("articles").select("id", { count: "exact", head: true })
    .not("status", "in", '(published,retired)');
  const allowNewTopics = (unfinishedArticles ?? 0) < MAX_PIPELINE_PARALLEL;

  // 4. Wenn nicht in Harvest-Window: nur Pipeline-Fortschritts-Jobs erstellen
  const inHarvest = isHarvestWindow();

  // 5. Pipeline-Stufen vorwärts treiben: für jeden 'done'-Job prüfen, ob nächste Stufe gestartet werden muss
  await progressPipelines(supabase, allowNewTopics);

  // Außerhalb Harvest-Minuten: keine User-Assignments. Nur Pipeline-Cleanup.
  if (!inHarvest) return json({ ok: true, mode: 'cleanup' });

  // 6. Aktive User in Batches (50) auswählen
  const { data: users } = await supabase
    .from("profiles")
    .select("id, donate_tokens, donate_threshold, swarm_jobs_today, swarm_jobs_reset_at, llm_api_key, huggingface_key, replicate_key, cloud_provider")
    .eq("donate_tokens", true)
    .limit(50);
  if (!users || users.length === 0) return json({ ok: true, users: 0 });

  let assigned = 0;
  for (const u of users) {
    // Daily-Counter reset
    if (u.swarm_jobs_reset_at !== today) {
      await supabase.from("profiles")
        .update({ swarm_jobs_today: 0, swarm_jobs_reset_at: today })
        .eq("id", u.id);
      u.swarm_jobs_today = 0;
    }
    if (u.swarm_jobs_today >= MAX_JOBS_PER_USER_PER_DAY) continue;

    // Capability-Set ermitteln
    const caps: string[] = [];
    if (u.llm_api_key) caps.push('llm');
    if (u.huggingface_key || u.replicate_key) caps.push('image');
    if (u.huggingface_key && u.cloud_provider) caps.push('rag');
    if (caps.length === 0) continue;

    // Quota-Probe
    if (u.llm_api_key) {
      const remPct = await probeLlmRemaining(u.llm_api_key);
      if (remPct !== null && remPct < u.donate_threshold) continue;
    }

    // Passenden waiting-Job suchen
    const { data: job } = await supabase
      .from("article_jobs")
      .select("id, job_type, required_capability, article_id")
      .eq("status", "waiting")
      .in("required_capability", caps)
      .order("created_at", { ascending: true })
      .limit(1).maybeSingle();
    if (!job) continue;

    // Zuweisen
    const dueAt = new Date(Date.now() + 5 * 60_000).toISOString();
    await supabase.from("article_jobs")
      .update({ status: 'assigned', assigned_to: u.id, assigned_at: new Date().toISOString(), due_at: dueAt })
      .eq("id", job.id);
    await supabase.from("profiles")
      .update({ swarm_jobs_today: u.swarm_jobs_today + 1 })
      .eq("id", u.id);
    assigned++;
  }

  return json({ ok: true, mode: 'harvest', users: users.length, assigned });
});

async function progressPipelines(supabase: any, allowNewTopics: boolean) {
  // Re-queue timed-out assigned-Jobs (over due_at, retry < 3)
  const now = new Date().toISOString();
  await supabase.from("article_jobs")
    .update({ status: 'waiting', assigned_to: null, retry_count: 0 })
    // pseudo: retry_count + 1 via raw; vereinfacht: status zurücksetzen
    .eq("status", "assigned")
    .lt("due_at", now);

  // Article-Status nach done-Jobs vorwärts treiben
  const { data: articles } = await supabase
    .from("articles")
    .select("id, status, topic_id")
    .not("status", "in", '(published,retired)');
  if (!articles) return;

  for (const art of articles) {
    // Existieren schon waiting/assigned-Jobs für diesen Artikel? → noch nicht weiter
    const { count: openJobs } = await supabase
      .from("article_jobs").select("id", { count: 'exact', head: true })
      .eq("article_id", art.id).in("status", ['waiting', 'assigned']);
    if ((openJobs ?? 0) > 0) continue;

    const next = nextJobType(art.status);
    if (!next) continue;

    const jobDef = JOBS[next];
    await supabase.from("article_jobs").insert({
      article_id: art.id, job_type: next,
      required_capability: jobDef.capability, status: 'waiting',
    });
  }

  // Neue topic_propose-Jobs für offene Topics, wenn Pipeline-Kapazität da ist
  if (!allowNewTopics) return;
  const { data: openTopics } = await supabase
    .from("topic_pool").select("id, title")
    .eq("status", "open").limit(3);
  if (!openTopics) return;
  for (const t of openTopics) {
    // Artikel anlegen
    const slug = String(t.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const { data: art } = await supabase.from("articles").insert({
      topic_id: t.id, title: t.title, slug: `${slug}-${Date.now()}`,
      status: 'proposed',
    }).select().single();
    if (!art) continue;
    await supabase.from("article_jobs").insert({
      article_id: art.id, job_type: 'topic_propose',
      required_capability: 'llm', status: 'waiting',
    });
    await supabase.from("topic_pool").update({ status: 'in_progress' }).eq("id", t.id);
  }
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}
