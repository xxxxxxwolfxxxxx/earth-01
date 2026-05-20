// swarm-worker
// POST { job_id } mit User-Auth. Worker führt den zugewiesenen Job aus
// mit dem User-eigenen LLM/Image-Key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JOBS, statusAfterJob } from "../_shared/swarmJobs.ts";
import { scoreContent } from "../_shared/qualityScore.ts";
import { generateImage } from "../_shared/imageGen.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS }});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth
  const authHeader = req.headers.get("Authorization") || "";
  const userToken = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user } } = await supabase.auth.getUser(userToken);
  if (!user) return json({ error: "Nicht angemeldet" }, 401);

  const body = await req.json().catch(() => ({}));
  const jobId = body?.job_id;
  if (!jobId) return json({ error: "job_id fehlt" }, 400);

  // Job laden, prüfen ob diesem User zugewiesen
  const { data: job } = await supabase.from("article_jobs")
    .select("id, article_id, job_type, status, assigned_to, required_capability")
    .eq("id", jobId).single();
  if (!job || job.assigned_to !== user.id) return json({ error: "Job nicht zugewiesen" }, 403);
  if (job.status !== "assigned") return json({ error: `Job-Status ist ${job.status}` }, 400);

  // Profile + Article + Topic laden
  const { data: profile } = await supabase.from("profiles")
    .select("llm_api_key, llm_base_url, llm_model, huggingface_key, replicate_key")
    .eq("id", user.id).single();
  const { data: article } = await supabase.from("articles").select("*").eq("id", job.article_id).single();
  const { data: topic } = article?.topic_id
    ? await supabase.from("topic_pool").select("*").eq("id", article.topic_id).single()
    : { data: null };

  if (!profile || !article) return json({ error: "Daten fehlen" }, 500);

  // Job ausführen
  const jobDef = JOBS[job.job_type as keyof typeof JOBS];
  if (!jobDef) return json({ error: `Unbekannter Job-Type ${job.job_type}` }, 400);

  let result: any = null;
  let success = false;
  try {
    if (jobDef.capability === 'image') {
      const prompt = jobDef.buildUserPrompt({ article, topic });
      const img = await generateImage({
        prompt, hfKey: profile.huggingface_key, replicateKey: profile.replicate_key,
      });
      if (img.ok && img.blob) {
        // Bild als Data-URL hinterlegen (für MVP — bei Skalierung in Storage)
        const buf = await img.blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const dataUrl = `data:image/png;base64,${base64}`;
        result = { image_url: dataUrl, provider: img.provider };
        success = true;
      } else {
        result = { error: img.error };
      }
    } else {
      // LLM-Job
      if (!profile.llm_api_key || !profile.llm_base_url || !profile.llm_model) {
        return json({ error: "LLM-Key fehlt im Profil" }, 400);
      }
      const sys = jobDef.buildSystemPrompt({ article, topic });
      const usr = jobDef.buildUserPrompt({ article, topic, reviewIssues: article._reviewIssues });
      const r = await fetch(`${profile.llm_base_url}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${profile.llm_api_key}` },
        body: JSON.stringify({
          model: profile.llm_model,
          messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
          temperature: 0.4,
        }),
      });
      const j = await r.json();
      const content = j?.choices?.[0]?.message?.content;
      if (!content) {
        result = { error: 'LLM lieferte keinen Inhalt' };
      } else {
        result = { content };
        success = true;
      }
    }

    if (!success) {
      await supabase.from("article_jobs").update({
        status: "failed", result, completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      return json({ ok: false, result });
    }

    // Quality-Score auf Text-Resultate
    let qScore: number | null = null;
    if (result.content && job.job_type !== 'review' && job.job_type !== 'topic_propose') {
      const score = await scoreContent({
        text: result.content,
        topic: article.title,
        factualSeed: topic?.context_seed,
        llmBaseUrl: profile.llm_base_url,
        llmKey: profile.llm_api_key,
        llmModel: profile.llm_model,
      });
      qScore = score.total;
      result.quality_reasoning = score.reasoning;
      if (score.rejected) {
        await supabase.from("article_jobs").update({
          status: "failed", result, quality_score: qScore, completed_at: new Date().toISOString(),
        }).eq("id", jobId);
        return json({ ok: false, rejected: true, score: qScore });
      }
    }

    // Apply result to article — abhängig vom Job-Typ
    await applyJobResult(supabase, article, job.job_type, result, user.id, jobId);

    // Job als done
    await supabase.from("article_jobs").update({
      status: "done", result, quality_score: qScore, completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return json({ ok: true, score: qScore });
  } catch (e) {
    await supabase.from("article_jobs").update({
      status: "failed", result: { error: (e as Error).message }, completed_at: new Date().toISOString(),
    }).eq("id", jobId);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

async function applyJobResult(supabase: any, article: any, jobType: string, result: any, userId: string, jobId: string) {
  let newBody = article.body_markdown ?? '';
  let newHero = article.hero_image_url;
  let newTitle = article.title;
  let newStatus = article.status;

  switch (jobType) {
    case 'topic_propose': {
      // result.content ist JSON-String { title, lead }
      try {
        const parsed = JSON.parse(result.content);
        if (parsed.title) newTitle = String(parsed.title).slice(0, 80);
        newBody = `${parsed.lead ?? ''}`;
      } catch {
        newBody = `${result.content}`;
      }
      newStatus = 'proposed';
      break;
    }
    case 'research': {
      newBody = `${article.body_markdown}\n\n## Recherche\n${result.content}`;
      newStatus = 'researched';
      break;
    }
    case 'draft': {
      newBody = result.content;
      newStatus = 'drafted';
      break;
    }
    case 'illustrate': {
      newHero = result.image_url;
      newStatus = 'illustrated';
      break;
    }
    case 'code_snippet': {
      if (result.content && !/(kein Code-Snippet)/i.test(result.content)) {
        newBody = `${article.body_markdown}\n\n## Beispiel\n${result.content}`;
      }
      break;
    }
    case 'review': {
      // result.content ist JSON
      try {
        const r = JSON.parse(result.content);
        if (r.needs_revise && (r.issues ?? []).length > 0) {
          // einen revise-Job einplanen
          await supabase.from("article_jobs").insert({
            article_id: article.id, job_type: 'revise',
            required_capability: 'llm', status: 'waiting',
            result: { review_issues: r.issues },
          });
        } else {
          newStatus = 'published';
        }
      } catch { newStatus = 'published'; }
      break;
    }
    case 'revise': {
      newBody = result.content;
      newStatus = 'reviewed';
      break;
    }
  }

  await supabase.from("articles").update({
    title: newTitle, body_markdown: newBody, hero_image_url: newHero,
    status: newStatus, contributor_count: article.contributor_count + 1,
    published_at: newStatus === 'published' ? new Date().toISOString() : article.published_at,
  }).eq("id", article.id);

  await supabase.from("article_revisions").insert({
    article_id: article.id, body_markdown: newBody,
    contributor_user_id: userId, job_id: jobId,
  });
}
