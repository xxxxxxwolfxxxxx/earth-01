// swarm-orchestrator
// Wird jede Minute von reminder-tick aufgerufen.
// Aufgabe: User mit bot_at_work=true identifizieren, ihnen Jobs zuweisen.
// Priorisiert Mammut-Jobs (priority=2).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JOBS, nextJobType } from "../_shared/swarmJobs.ts";

const ACTIVATION_THRESHOLD = 1;          // Phase 4.5: Solo-Modus — eigener Bot darf eigene Jobs erledigen
const DEFAULT_MAX_JOBS_PER_USER_PER_DAY = 10;
const MAX_PIPELINE_PARALLEL = 3;         // Phase 4.11: Artikel nacheinander, nicht 20 gleichzeitig
const MAX_JOBS_PER_DAY_PLATFORM = 1000;

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Activation-Gate
  const { count: activeCount } = await supabase
    .from("profiles").select("id", { count: "exact", head: true })
    .eq("bot_at_work", true);
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

  // 3. Backpressure: zu viele Artikel in der Pipeline? + Pool-Budget da?
  const { count: unfinishedArticles } = await supabase
    .from("articles").select("id", { count: "exact", head: true })
    .not("status", "in", '(published,retired)');
  // Earth beauftragt nur neue Artikel wenn der Pool ~1 Artikel (6 Credits) trägt
  const { data: poolBal } = await supabase.rpc('pool_balance');
  const poolHasBudget = Number(poolBal ?? 0) >= 6;
  const allowNewTopics = (unfinishedArticles ?? 0) < MAX_PIPELINE_PARALLEL && poolHasBudget;

  // 4. Inaktive Bots aufwecken: User, deren bot_at_work seit 24h ohne Aktivität
  await idleBotsToHome(supabase);

  // 4b. Pausierte Mammut-Tasks reaktivieren wenn Owner wieder Credits hat
  await supabase.rpc('resume_paused_mammoths');

  // 5. Pipeline-Progression (waiting-Jobs neu, fertige Stufen → nächste)
  await progressPipelines(supabase, allowNewTopics);

  // 6. Aktive Bots in Batches (50)
  const { data: users } = await supabase
    .from("profiles")
    .select("id, swarm_jobs_today, swarm_jobs_reset_at, max_jobs_per_day, llm_api_key, huggingface_key, replicate_key, cloud_provider")
    .eq("bot_at_work", true)
    .limit(50);
  if (!users || users.length === 0) return json({ ok: true, users: 0 });

  let assigned = 0;
  let executed = 0;
  for (const u of users) {
    // Daily-Counter reset
    if (u.swarm_jobs_reset_at !== today) {
      await supabase.from("profiles")
        .update({ swarm_jobs_today: 0, swarm_jobs_reset_at: today })
        .eq("id", u.id);
      u.swarm_jobs_today = 0;
    }
    let userCap = u.max_jobs_per_day ?? DEFAULT_MAX_JOBS_PER_USER_PER_DAY;
    // Auto-Failover: wenn aktiver Key am Cap, zum nächsten Reserve-Provider rotieren
    if (u.swarm_jobs_today >= userCap) {
      const { data: rot } = await supabase.rpc('auto_rotate_llm', { p_user_id: u.id });
      if (rot?.rotated) {
        // Frische Werte neu laden
        const { data: refreshed } = await supabase
          .from("profiles").select("swarm_jobs_today, max_jobs_per_day, llm_api_key, huggingface_key, replicate_key, cloud_provider")
          .eq("id", u.id).single();
        if (refreshed) {
          u.swarm_jobs_today = refreshed.swarm_jobs_today;
          u.llm_api_key      = refreshed.llm_api_key;
          u.huggingface_key  = refreshed.huggingface_key;
          u.replicate_key    = refreshed.replicate_key;
          u.cloud_provider   = refreshed.cloud_provider;
          userCap = refreshed.max_jobs_per_day ?? DEFAULT_MAX_JOBS_PER_USER_PER_DAY;
        }
      }
    }
    // Cap nur für fremde Jobs durchsetzen. Eigene Mammut-Jobs zählen extra: der
    // User hat sie ja schon mit eigenen Credits bezahlt — die Quota ist sein eigenes
    // API-Budget. Wir prüfen das weiter unten beim Job-Match.
    const overOwnCap = u.swarm_jobs_today >= userCap;

    // Capabilities
    const caps: string[] = [];
    if (u.llm_api_key) caps.push('llm');
    if (u.huggingface_key || u.replicate_key) caps.push('image');
    if (u.huggingface_key && u.cloud_provider) caps.push('rag');
    if (caps.length === 0) continue;

    // Job suchen — Mammut-Jobs (priority=2) vor regulären (priority=1).
    // Eigene Mammut-Jobs sind immer fair game, weil der User sie selbst bezahlt
    // und sein eigenes API-Budget belastet. Externe Jobs nur wenn unter Cap.
    let job = null;

    // Erstmal versuchen: eigener Mammut-Job des Users (über mammoth_tasks.user_id)
    const { data: ownMammoth } = await supabase
      .from("article_jobs")
      .select("id, job_type, required_capability, article_id, mammoth_task_id, mammoth_tasks!inner(user_id)")
      .eq("status", "waiting")
      .in("required_capability", caps)
      .eq("mammoth_tasks.user_id", u.id)
      .order("created_at", { ascending: true })
      .limit(1).maybeSingle();
    if (ownMammoth) {
      job = ownMammoth;
    } else if (!overOwnCap) {
      // Kein eigener offen, Cap noch nicht ausgeschöpft → fremder Job.
      // Nach articles.created_at sortieren: der älteste Artikel wird komplett
      // fertiggestellt bevor jüngere drankommen (sequenziell statt parallel).
      const { data: extJob } = await supabase
        .from("article_jobs")
        .select("id, job_type, required_capability, article_id, mammoth_task_id, articles!inner(created_at)")
        .eq("status", "waiting")
        .in("required_capability", caps)
        .order("created_at", { referencedTable: "articles", ascending: true })
        .order("created_at", { ascending: true })
        .limit(1).maybeSingle();
      job = extJob;
    }
    if (!job) continue;

    // Mammut-Job? Erst 1 Credit vom Owner abbuchen (atomisch).
    // Bei leerem Guthaben pausiert die RPC den Task und skipt den Job.
    if (job.mammoth_task_id) {
      const { data: paid } = await supabase.rpc('pay_for_mammoth_job', { p_task_id: job.mammoth_task_id });
      if (!paid) continue; // Nicht bezahlt → nicht zuweisen, anderer Job beim nächsten Tick
    }

    const dueAt = new Date(Date.now() + 10 * 60_000).toISOString();
    await supabase.from("article_jobs")
      .update({ status: 'assigned', assigned_to: u.id, assigned_at: new Date().toISOString(), due_at: dueAt })
      .eq("id", job.id);
    await supabase.from("profiles")
      .update({ swarm_jobs_today: u.swarm_jobs_today + 1 })
      .eq("id", u.id);
    u.swarm_jobs_today += 1;
    assigned++;

    // Job direkt serverseitig ausführen (Tempo-Limit: max 3 pro Tick).
    // Vorher lief das nur im Browser — Bot konnte nachts nicht arbeiten.
    if (executed < MAX_EXECUTE_PER_TICK) {
      try {
        await runWorker(job.id, u.id);
        executed++;
      } catch (e) {
        console.warn("Worker-Call fehlgeschlagen:", (e as Error).message);
      }
    }
  }

  return json({ ok: true, users: users.length, assigned, executed, activeCount });
});

const MAX_EXECUTE_PER_TICK = 3;

// Ruft den swarm-worker serverseitig auf (Service-Role-Modus).
async function runWorker(jobId: string, userId: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(`${url}/functions/v1/swarm-worker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ job_id: jobId, user_id: userId }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`swarm-worker HTTP ${r.status}: ${txt.slice(0, 200)}`);
  }
}

async function idleBotsToHome(supabase: any) {
  // Bots > 24h at_work ohne Job-Assignment → zurück nach Hause
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  await supabase.from("profiles")
    .update({ bot_at_work: false })
    .eq("bot_at_work", true)
    .lt("bot_work_started_at", cutoff);
}

async function progressPipelines(supabase: any, allowNewTopics: boolean) {
  // Re-queue timed-out assigned-Jobs (over due_at)
  const now = new Date().toISOString();
  await supabase.from("article_jobs")
    .update({ status: 'waiting', assigned_to: null })
    .eq("status", "assigned")
    .lt("due_at", now);

  // Mammut-Job-Kette: für jeden Task mit fertigem letzten Job den nächsten
  // 'blocked'-Job freischalten. So läuft die Pipeline sequenziell.
  const { data: openMammoths } = await supabase
    .from("mammoth_tasks").select("id")
    .in("status", ['pending', 'in_progress', 'paused_low_credits']);
  for (const t of openMammoths ?? []) {
    const { count: openOrAssigned } = await supabase
      .from("article_jobs").select("id", { count: 'exact', head: true })
      .eq("mammoth_task_id", t.id).in("status", ['waiting', 'assigned']);
    if ((openOrAssigned ?? 0) > 0) continue;
    // Keinen laufenden — gibt's noch 'blocked'? Den ältesten freischalten.
    const { data: nextJob } = await supabase
      .from("article_jobs").select("id")
      .eq("mammoth_task_id", t.id).eq("status", "blocked")
      .order("created_at", { ascending: true })
      .limit(1).maybeSingle();
    if (nextJob) {
      await supabase.from("article_jobs")
        .update({ status: 'waiting' }).eq("id", nextJob.id);
    } else {
      // Keine blocked Jobs mehr → Task komplett fertig
      await supabase.from("mammoth_tasks")
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq("id", t.id).neq("status", 'completed');
    }
  }

  // Kann irgendein arbeitender Bot Bilder? Wenn nein, wird die illustrate-Stufe
  // übersprungen — sonst würde die Pipeline ewig hängen.
  const { data: workingBots } = await supabase
    .from("profiles").select("huggingface_key, replicate_key")
    .eq("bot_at_work", true);
  const swarmHasImageCap = (workingBots ?? []).some(
    (b: any) => b.huggingface_key || b.replicate_key
  );

  if (!swarmHasImageCap) {
    // Kein Bild-Bot: wartende illustrate-Jobs auf 'skipped' setzen (NICHT 'done' —
    // 'skipped' bleibt als Merker, dass die Illustration noch fehlt). Artikel läuft
    // ohne Bild weiter.
    const { data: stuckImg } = await supabase
      .from("article_jobs")
      .select("id, article_id")
      .eq("job_type", "illustrate")
      .in("status", ['waiting', 'assigned']);
    for (const ij of stuckImg ?? []) {
      await supabase.from("article_jobs")
        .update({ status: 'skipped', result: { skipped: 'kein Bild-Bot im Schwarm' } })
        .eq("id", ij.id);
      await supabase.from("articles")
        .update({ status: 'illustrated' }).eq("id", ij.article_id);
    }
  } else {
    // Bild-Bot ist jetzt da → übersprungene Illustrationen nachreichen.
    // 'skipped' → 'waiting', der Schwarm holt sie nach, applyJobResult fügt das
    // Bild auch in bereits veröffentlichte Artikel ein.
    await supabase.from("article_jobs")
      .update({ status: 'waiting', result: null })
      .eq("job_type", "illustrate")
      .eq("status", "skipped");
  }

  // Article-Status nach done-Jobs vorwärts treiben.
  // SEQUENZIELL: nur die ältesten 2 Artikel werden aktiv vorangetrieben,
  // der Rest wartet bis die Vorreiter veröffentlicht sind. So entstehen
  // schnell ein paar FERTIGE Artikel statt 20 halbfertige.
  const SEQUENTIAL_ACTIVE = 2;
  const { data: articles } = await supabase
    .from("articles")
    .select("id, status, topic_id, created_at")
    .not("status", "in", '(published,retired)')
    .order("created_at", { ascending: true })
    .order("id", { ascending: true }); // stabiler Tiebreaker bei gleichem Timestamp
  if (!articles) return;

  let advanced = 0;
  for (const art of articles) {
    if (advanced >= SEQUENTIAL_ACTIVE) break;
    const { count: openJobs } = await supabase
      .from("article_jobs").select("id", { count: 'exact', head: true })
      .eq("article_id", art.id).in("status", ['waiting', 'assigned']);
    if ((openJobs ?? 0) > 0) { advanced++; continue; }

    let next = nextJobType(art.status);
    if (!next) continue;

    // illustrate überspringen wenn kein Bot Bilder kann → Artikel direkt auf 'illustrated'
    if (next === 'illustrate' && !swarmHasImageCap) {
      await supabase.from("articles")
        .update({ status: 'illustrated' }).eq("id", art.id);
      next = nextJobType('illustrated'); // → review
      if (!next) continue;
    }

    const jobDef = JOBS[next];
    await supabase.from("article_jobs").insert({
      article_id: art.id, job_type: next,
      required_capability: jobDef.capability, status: 'waiting', priority: 1,
    });
    advanced++;
  }

  // Neue topic_propose-Jobs für offene Topics (Pool-finanziert)
  if (!allowNewTopics) return;
  const { data: openTopics } = await supabase
    .from("topic_pool").select("id, title")
    .eq("status", "open").limit(3);
  if (!openTopics) return;
  for (const t of openTopics) {
    const slug = String(t.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const { data: art } = await supabase.from("articles").insert({
      topic_id: t.id, title: t.title, slug: `${slug}-${Date.now()}`,
      status: 'proposed',
    }).select().single();
    if (!art) continue;
    await supabase.from("article_jobs").insert({
      article_id: art.id, job_type: 'topic_propose',
      required_capability: 'llm', status: 'waiting', priority: 1,
    });
    await supabase.from("topic_pool").update({ status: 'in_progress' }).eq("id", t.id);
  }
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}
