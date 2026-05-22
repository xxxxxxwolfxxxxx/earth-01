// start-mammoth
// POST { prompt, plan } — User-Auth.
// Erstellt mammoth_tasks + article_jobs aus dem Plan.
// Credit-Abbuchung passiert NICHT upfront, sondern Job-für-Job durch den Orchestrator
// (pay_for_mammoth_job RPC). Bei leerem Guthaben: Task pausiert, sobald Credits da
// sind setzt der Orchestrator ihn fort.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MAMMOTH_JOBS } from "../_shared/mammothWebsite.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ error: "Nicht angemeldet" }, 401);

  const body = await req.json().catch(() => ({}));
  const { prompt, plan } = body ?? {};
  if (!prompt || typeof prompt !== 'string') return json({ error: "prompt fehlt" }, 400);
  if (!plan?.jobs || !Array.isArray(plan.jobs) || plan.jobs.length === 0) {
    return json({ error: "plan.jobs fehlt — erst /functions/v1/mammoth-estimate rufen" }, 400);
  }

  // Job-Typen validieren — nur bekannte mammoth_* erlaubt
  const validJobs = plan.jobs.filter((j: any) => MAMMOTH_JOBS[j.type as keyof typeof MAMMOTH_JOBS]);
  if (validJobs.length === 0) return json({ error: "Kein gültiger Job im Plan" }, 400);

  // Schon ein laufendes Projekt?
  const { count: openCount } = await supabase.from("mammoth_tasks")
    .select("id", { count: 'exact', head: true })
    .eq("user_id", user.id)
    .in("status", ['pending', 'in_progress', 'paused_low_credits']);
  if ((openCount ?? 0) > 0) {
    return json({ error: "Du hast bereits ein laufendes Projekt. Erst fertig machen oder abbrechen." }, 400);
  }

  const totalCost = validJobs.reduce((s: number, j: any) => s + (j.credits ?? 1), 0);

  // Profile lesen für initialen Status
  const { data: profile } = await supabase
    .from("profiles").select("job_credits").eq("id", user.id).single();
  const credits = Number(profile?.job_credits ?? 0);
  const initialStatus = credits >= 1 ? 'pending' : 'paused_low_credits';

  // mammoth_tasks anlegen
  const title = String(plan.title ?? prompt).slice(0, 100);
  const { data: task, error: taskErr } = await supabase.from("mammoth_tasks").insert({
    user_id: user.id,
    task_type: 'website',
    title,
    brief_prompt: prompt,
    job_plan: validJobs,
    brief: { title, prompt, summary: plan.summary ?? '' },
    credits_cost: totalCost,
    cost_total: totalCost,
    cost_paid: 0,
    status: initialStatus,
    started_at: new Date().toISOString(),
  }).select().single();
  if (taskErr || !task) return json({ error: `mammoth_tasks insert: ${taskErr?.message}` }, 500);

  // Pseudo-Article für article_jobs
  const slug = `mammoth-${task.id.slice(0, 8)}`;
  const { data: art, error: artErr } = await supabase.from("articles").insert({
    title,
    slug,
    status: 'proposed',
    body_markdown: '(Projekt — Ergebnis siehe mammoth_tasks)',
  }).select().single();
  if (artErr || !art) {
    await supabase.from("mammoth_tasks").delete().eq("id", task.id);
    return json({ error: `article insert: ${artErr?.message}` }, 500);
  }

  // Article_jobs in der Plan-Reihenfolge anlegen
  const jobsToInsert = validJobs.map((j: any, idx: number) => ({
    article_id: art.id,
    mammoth_task_id: task.id,
    job_type: j.type,
    required_capability: MAMMOTH_JOBS[j.type as keyof typeof MAMMOTH_JOBS].capability,
    status: idx === 0 ? 'waiting' : 'blocked', // erster Job läuft an, Rest wartet auf Vorgänger
    priority: 2,
  }));
  const { error: jobsErr } = await supabase.from("article_jobs").insert(jobsToInsert);
  if (jobsErr) {
    await supabase.from("articles").delete().eq("id", art.id);
    await supabase.from("mammoth_tasks").delete().eq("id", task.id);
    return json({ error: `article_jobs insert: ${jobsErr.message}` }, 500);
  }

  return json({
    ok: true,
    task_id: task.id,
    status: initialStatus,
    cost_total: totalCost,
    job_count: validJobs.length,
    credits_after: credits,
    paused: initialStatus === 'paused_low_credits',
  });
});
