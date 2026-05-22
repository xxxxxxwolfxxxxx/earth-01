// swarm-worker
// POST { job_id } mit User-Auth. Worker führt den zugewiesenen Job aus
// mit dem User-eigenen LLM/Image-Key.
//
// Phase 4: nach jedem Job 0.9 Credits an User, 0.1 in Community-Pool.
// Mammoth-Jobs nutzen separates Prompt-Set + Pipeline-Kontext.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JOBS, statusAfterJob } from "../_shared/swarmJobs.ts";
import { MAMMOTH_JOBS } from "../_shared/mammothWebsite.ts";
import { scoreContent } from "../_shared/qualityScore.ts";
import { generateImage } from "../_shared/imageGen.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const USER_SHARE = 0.9;
const POOL_SHARE = 0.1;

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

  const authHeader = req.headers.get("Authorization") || "";
  const userToken = authHeader.replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const body = await req.json().catch(() => ({}));
  const jobId = body?.job_id;
  if (!jobId) return json({ error: "job_id fehlt" }, 400);

  // Zwei Modi:
  //  a) Browser-Modus — User-JWT, getUser() liefert den User
  //  b) Server-Modus  — Orchestrator ruft mit Service-Role + body.user_id
  let user: { id: string };
  if (userToken === serviceKey && body?.user_id) {
    user = { id: body.user_id };
  } else {
    const { data: { user: authedUser } } = await supabase.auth.getUser(userToken);
    if (!authedUser) return json({ error: "Nicht angemeldet" }, 401);
    user = authedUser;
  }

  const { data: job } = await supabase.from("article_jobs")
    .select("id, article_id, job_type, status, assigned_to, required_capability, mammoth_task_id")
    .eq("id", jobId).single();
  if (!job || job.assigned_to !== user.id) return json({ error: "Job nicht zugewiesen" }, 403);
  if (job.status !== "assigned") return json({ error: `Job-Status ist ${job.status}` }, 400);

  const { data: profile } = await supabase.from("profiles")
    .select("llm_api_key, llm_base_url, llm_model, huggingface_key, replicate_key")
    .eq("id", user.id).single();
  const { data: article } = await supabase.from("articles").select("*").eq("id", job.article_id).single();
  if (!profile || !article) return json({ error: "Daten fehlen" }, 500);

  const isMammoth = String(job.job_type).startsWith("mammoth_");

  // Mehrere Job-Typen brauchen das Topic im Kontext (topic_propose, research …).
  // Immer laden wenn der Artikel ein Topic hat. Fallback {} damit ctx.topic.* nie crasht.
  let topic: any = {};
  if (!isMammoth && article.topic_id) {
    const { data: t } = await supabase.from("topic_pool").select("*").eq("id", article.topic_id).single();
    if (t) topic = t;
  }

  // Mammoth-Kontext laden (alle bisherigen Job-Results für diese Task)
  let mammothCtx: any = null;
  let mammothTask: any = null;
  if (isMammoth && job.mammoth_task_id) {
    const { data: mt } = await supabase.from("mammoth_tasks").select("*").eq("id", job.mammoth_task_id).single();
    mammothTask = mt;
    const { data: prevJobs } = await supabase.from("article_jobs")
      .select("job_type, result")
      .eq("mammoth_task_id", job.mammoth_task_id)
      .eq("status", "done");
    const results: Record<string, any> = {};
    for (const pj of (prevJobs ?? [])) results[pj.job_type] = pj.result;
    mammothCtx = { brief: mt?.brief ?? {}, results };
  }

  let result: any = null;
  let success = false;

  try {
    // ── Spezialfall: mammoth_package — ZIP bauen, kein LLM/Image ──
    if (job.job_type === 'mammoth_package' && mammothCtx) {
      result = await packageWebsite(supabase, mammothTask, mammothCtx);
      success = !!result.result_url;
    }
    // ── Image-Jobs (regulär oder mammoth) ──
    else if (job.required_capability === 'image') {
      const def = isMammoth ? MAMMOTH_JOBS[job.job_type as keyof typeof MAMMOTH_JOBS] : JOBS[job.job_type as keyof typeof JOBS];
      const prompt = def.buildUserPrompt(isMammoth ? mammothCtx : { article });
      const img = await generateImage({
        prompt, hfKey: profile.huggingface_key, replicateKey: profile.replicate_key,
      });
      if (img.ok && img.blob) {
        const buf = await img.blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const dataUrl = `data:image/png;base64,${base64}`;
        result = { image_url: dataUrl, provider: img.provider };
        success = true;
      } else {
        result = { error: img.error };
      }
    }
    // ── LLM-Jobs (regulär oder mammoth) ──
    else {
      if (!profile.llm_api_key || !profile.llm_base_url || !profile.llm_model) {
        return json({ error: "LLM-Key fehlt im Profil" }, 400);
      }
      const def = isMammoth ? MAMMOTH_JOBS[job.job_type as keyof typeof MAMMOTH_JOBS] : JOBS[job.job_type as keyof typeof JOBS];
      const regularCtx = { article, reviewIssues: article._reviewIssues, topic };
      const sys = def.buildSystemPrompt(isMammoth ? mammothCtx : regularCtx);
      const usr = def.buildUserPrompt(isMammoth ? mammothCtx : regularCtx);
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
      if (!content) result = { error: 'LLM lieferte keinen Inhalt' };
      else { result = { content }; success = true; }
    }

    if (!success) {
      await supabase.from("article_jobs").update({
        status: "failed", result, completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      return json({ ok: false, result });
    }

    // Quality-Score nur für reguläre Text-Jobs (mammoth hat eigene review-Stufe)
    let qScore: number | null = null;
    if (!isMammoth && result.content && job.job_type !== 'review' && job.job_type !== 'topic_propose') {
      const score = await scoreContent({
        text: result.content,
        topic: article.title,
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

    // Reguläre Jobs: Result auf Artikel anwenden
    if (!isMammoth) {
      await applyJobResult(supabase, article, job.job_type, result, user.id, jobId);
    }

    // Job als done markieren
    await supabase.from("article_jobs").update({
      status: "done", result, quality_score: qScore, completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    // ── Credits buchen ──
    if (isMammoth) {
      // Mammut: User hat schon bezahlt (pay_for_mammoth_job), kriegt 0.9 zurück,
      // 0.1 Steuer fließt in den Pool.
      await supabase.rpc('book_credits', {
        p_user_id: user.id,
        p_user_share: USER_SHARE,
        p_pool_share: POOL_SHARE,
      });
    } else {
      // Schwarm-Artikel: Earth (Community-Pool) ist Auftraggeber und zahlt den
      // vollen Lohn. Bot bekommt 1.0 pro Job, keine Steuer.
      await supabase.rpc('book_article_credits', {
        p_user_id: user.id,
        p_amount: 1.0,
      });
    }

    // ── Mammoth-Progress + ggf. Result auf Task übertragen ──
    if (isMammoth && job.mammoth_task_id) {
      await supabase.rpc('update_mammoth_progress', { p_task_id: job.mammoth_task_id });
      // Bei mammoth_package: Result-URL in task speichern
      if (job.job_type === 'mammoth_package' && result.result_url) {
        await supabase.from("mammoth_tasks").update({
          result_url: result.result_url,
          result_data: result,
        }).eq("id", job.mammoth_task_id);
      }
    }

    return json({ ok: true, score: qScore, credits_earned: USER_SHARE });
  } catch (e) {
    await supabase.from("article_jobs").update({
      status: "failed", result: { error: (e as Error).message }, completed_at: new Date().toISOString(),
    }).eq("id", jobId);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

// ── Reguläre Pipeline-Apply (Phase 3-Logik) ──
async function applyJobResult(supabase: any, article: any, jobType: string, result: any, userId: string, jobId: string) {
  let newBody = article.body_markdown ?? '';
  let newHero = article.hero_image_url;
  let newTitle = article.title;
  let newStatus = article.status;

  switch (jobType) {
    case 'topic_propose': {
      try {
        const parsed = JSON.parse(result.content);
        if (parsed.title) newTitle = String(parsed.title).slice(0, 80);
        newBody = `${parsed.lead ?? ''}`;
      } catch { newBody = `${result.content}`; }
      newStatus = 'proposed';
      break;
    }
    case 'research':
      newBody = `${article.body_markdown}\n\n## Recherche\n${result.content}`;
      newStatus = 'researched'; break;
    case 'draft':
      newBody = result.content; newStatus = 'drafted'; break;
    case 'illustrate':
      // Nachgereichte Illustration: Bild setzen, aber einen schon veröffentlichten
      // Artikel NICHT zurück auf 'illustrated' werfen.
      newHero = result.image_url;
      if (article.status !== 'published') newStatus = 'illustrated';
      break;
    case 'code_snippet':
      if (result.content && !/(kein Code-Snippet)/i.test(result.content)) {
        newBody = `${article.body_markdown}\n\n## Beispiel\n${result.content}`;
      }
      break;
    case 'review':
      try {
        const r = JSON.parse(result.content);
        if (r.needs_revise && (r.issues ?? []).length > 0) {
          await supabase.from("article_jobs").insert({
            article_id: article.id, job_type: 'revise',
            required_capability: 'llm', status: 'waiting',
            result: { review_issues: r.issues }, priority: 1,
          });
        } else newStatus = 'published';
      } catch { newStatus = 'published'; }
      break;
    case 'revise':
      newBody = result.content; newStatus = 'reviewed'; break;
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

// ── Mammoth-Package: echtes ZIP mit allen Dateien bauen ──
async function packageWebsite(supabase: any, task: any, ctx: any): Promise<any> {
  const html = ctx.results.mammoth_revise?.content ? extractJsonField(ctx.results.mammoth_revise.content, 'html') || ctx.results.mammoth_html_assemble?.content
              : ctx.results.mammoth_html_assemble?.content;
  const css  = ctx.results.mammoth_revise?.content ? extractJsonField(ctx.results.mammoth_revise.content, 'css') || ctx.results.mammoth_css_styling?.content
              : ctx.results.mammoth_css_styling?.content;
  const heroImg = ctx.results.mammoth_image_hero?.image_url;
  const secondaryImg = ctx.results.mammoth_image_secondary?.image_url;

  if (!html || !css) return { error: 'HTML oder CSS fehlt im Mammoth-Kontext' };

  const zip = new JSZip();
  zip.file('index.html', html);
  zip.file('style.css', css);
  zip.file('README.md', `# ${task.title}\n\nGeneriert von Earth 0.1 — Mammutaufgabe.\nÖffne index.html im Browser oder lade den Ordner auf Netlify/Vercel.\n`);

  if (heroImg) {
    const bytes = dataUrlToBytes(heroImg);
    if (bytes) zip.file('hero.png', bytes);
  }
  if (secondaryImg) {
    const bytes = dataUrlToBytes(secondaryImg);
    if (bytes) zip.file('image-2.png', bytes);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const path = `${task.user_id}/${task.id}/website.zip`;
  const { error: upErr } = await supabase.storage.from('mammoth-results').upload(path, zipBlob, {
    upsert: true, contentType: 'application/zip',
  });
  if (upErr) return { error: `Upload: ${upErr.message}` };
  const { data: pub } = supabase.storage.from('mammoth-results').getPublicUrl(path);
  return { result_url: pub.publicUrl, zip_path: path, size_bytes: zipBlob.size };
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const m = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  try {
    const binary = atob(m[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch { return null; }
}

function extractJsonField(content: string, field: string): string | null {
  try {
    const parsed = JSON.parse(content);
    return parsed[field] ?? null;
  } catch { return null; }
}
