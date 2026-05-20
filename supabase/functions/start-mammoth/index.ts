// start-mammoth
// POST { task_type: 'website', brief: {...} } mit User-Auth.
// Bucht Credits ab (50), erzeugt mammoth_tasks-Eintrag,
// legt die Job-Pipeline an (alle waiting, priority=2).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MAMMOTH_WEBSITE_PIPELINE, MAMMOTH_JOBS } from "../_shared/mammothWebsite.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COST_WEBSITE = 50;

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

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ error: "Nicht angemeldet" }, 401);

  const body = await req.json().catch(() => ({}));
  const taskType = body?.task_type;
  const brief = body?.brief;
  if (taskType !== 'website') return json({ error: "Nur task_type='website' unterstützt" }, 400);
  if (!brief || typeof brief !== 'object') return json({ error: "brief fehlt" }, 400);
  if (!brief.title || typeof brief.title !== 'string') return json({ error: "brief.title fehlt" }, 400);

  // Profile + Credit-Check
  const { data: profile } = await supabase
    .from("profiles")
    .select("job_credits")
    .eq("id", user.id).single();
  if (!profile) return json({ error: "Profil nicht gefunden" }, 404);
  if (Number(profile.job_credits) < COST_WEBSITE) {
    return json({ error: `Nicht genug Credits. Du hast ${profile.job_credits}, brauchst ${COST_WEBSITE}.` }, 400);
  }

  // Bereits laufende Mammut-Task?
  const { count: openCount } = await supabase.from("mammoth_tasks")
    .select("id", { count: 'exact', head: true })
    .eq("user_id", user.id)
    .in("status", ['pending', 'in_progress']);
  if ((openCount ?? 0) > 0) {
    return json({ error: "Du hast bereits eine laufende Mammutaufgabe." }, 400);
  }

  // Insert task
  const { data: task, error: taskErr } = await supabase.from("mammoth_tasks").insert({
    user_id: user.id,
    task_type: 'website',
    title: String(brief.title).slice(0, 100),
    brief,
    credits_cost: COST_WEBSITE,
    status: 'pending',
    started_at: new Date().toISOString(),
  }).select().single();
  if (taskErr || !task) return json({ error: `mammoth_tasks insert: ${taskErr?.message}` }, 500);

  // Credits abbuchen
  const { error: bookErr } = await supabase
    .from("profiles")
    .update({ job_credits: Number(profile.job_credits) - COST_WEBSITE })
    .eq("id", user.id);
  if (bookErr) {
    // Rollback
    await supabase.from("mammoth_tasks").delete().eq("id", task.id);
    return json({ error: `Credit-Buchung: ${bookErr.message}` }, 500);
  }

  // Pseudo-Article anlegen (damit article_jobs eine article_id haben können)
  const slug = `mammoth-${task.id.slice(0, 8)}`;
  const { data: art, error: artErr } = await supabase.from("articles").insert({
    title: task.title,
    slug,
    status: 'proposed',
    body_markdown: '(Mammutaufgabe — Ergebnis siehe mammoth_tasks)',
  }).select().single();
  if (artErr || !art) {
    await supabase.from("profiles").update({ job_credits: Number(profile.job_credits) }).eq("id", user.id);
    await supabase.from("mammoth_tasks").delete().eq("id", task.id);
    return json({ error: `article insert: ${artErr?.message}` }, 500);
  }

  // Job-Pipeline anlegen (alle waiting, priority=2)
  const jobsToInsert = MAMMOTH_WEBSITE_PIPELINE.map(jt => ({
    article_id: art.id,
    mammoth_task_id: task.id,
    job_type: jt,
    required_capability: MAMMOTH_JOBS[jt].capability,
    status: 'waiting',
    priority: 2,
  }));
  const { error: jobsErr } = await supabase.from("article_jobs").insert(jobsToInsert);
  if (jobsErr) {
    return json({ error: `jobs insert: ${jobsErr.message}` }, 500);
  }

  await supabase.from("mammoth_tasks").update({ status: 'in_progress' }).eq("id", task.id);

  return json({ ok: true, task_id: task.id, jobs_created: jobsToInsert.length });
});
