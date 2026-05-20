// quota-check
// HTTP POST mit Auth-Header. Liest die Service-Keys des Users aus dem Profil
// und ruft pro Provider den passenden Usage-Endpoint (oder einen Probe-Call)
// auf, um aktuelle Free-Tier-Limits zurückzugeben.
//
// Output: { providers: [ { id, name, ok, used?, limit?, remaining?, unit?, resetAt?, note? } ] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

interface Result {
  id: string;
  name: string;
  ok: boolean;
  used?: number;
  limit?: number;
  remaining?: number;
  unit?: string;       // 'tokens' | 'chars' | 'calls' | 'credits'
  resetAt?: string;
  note?: string;
  error?: string;
}

function detectLlmProvider(key: string): { id: string; name: string; baseUrl: string } | null {
  if (key.startsWith("gsk_"))    return { id: "groq",      name: "Groq",       baseUrl: "https://api.groq.com/openai/v1" };
  if (key.startsWith("sk-or-"))  return { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" };
  if (key.startsWith("nvapi-"))  return { id: "nvidia",    name: "NVIDIA NIM",  baseUrl: "https://integrate.api.nvidia.com/v1" };
  if (key.startsWith("sk-ant-")) return { id: "anthropic", name: "Anthropic",   baseUrl: "https://api.anthropic.com/v1" };
  if (key.startsWith("sk-"))     return { id: "openai",    name: "OpenAI",      baseUrl: "https://api.openai.com/v1" };
  return null;
}

// LLM-Probe: kleiner /models-Call. Liest Rate-Limit-Header aus.
async function probeLlm(key: string): Promise<Result> {
  const p = detectLlmProvider(key);
  if (!p) return { id: "llm_unknown", name: "Sprachmodell", ok: false, error: "Provider-Prefix unbekannt" };
  try {
    const r = await fetch(`${p.baseUrl}/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return { id: p.id, name: p.name, ok: false, error: `HTTP ${r.status}` };
    const remTokens = r.headers.get("x-ratelimit-remaining-tokens");
    const limTokens = r.headers.get("x-ratelimit-limit-tokens");
    const remReq    = r.headers.get("x-ratelimit-remaining-requests");
    const limReq    = r.headers.get("x-ratelimit-limit-requests");
    const reset     = r.headers.get("x-ratelimit-reset-tokens") || r.headers.get("x-ratelimit-reset-requests");
    if (remTokens) {
      return {
        id: p.id, name: p.name, ok: true,
        remaining: Number(remTokens),
        limit: limTokens ? Number(limTokens) : undefined,
        used: limTokens ? (Number(limTokens) - Number(remTokens)) : undefined,
        unit: "tokens",
        resetAt: reset || undefined,
        note: "Pro Minute",
      };
    }
    if (remReq) {
      return {
        id: p.id, name: p.name, ok: true,
        remaining: Number(remReq),
        limit: limReq ? Number(limReq) : undefined,
        used: limReq ? (Number(limReq) - Number(remReq)) : undefined,
        unit: "calls",
        resetAt: reset || undefined,
        note: "Pro Minute",
      };
    }
    return { id: p.id, name: p.name, ok: true, note: "Aktiv (kein Quota-Header)" };
  } catch (e) {
    return { id: p.id, name: p.name, ok: false, error: (e as Error).message };
  }
}

async function probeElevenlabs(key: string): Promise<Result> {
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": key } });
    if (!r.ok) return { id: "elevenlabs", name: "ElevenLabs", ok: false, error: `HTTP ${r.status}` };
    const j: any = await r.json();
    const used = j?.subscription?.character_count ?? 0;
    const limit = j?.subscription?.character_limit ?? 0;
    return {
      id: "elevenlabs", name: "ElevenLabs", ok: true,
      used, limit, remaining: limit - used, unit: "chars",
      note: j?.subscription?.tier || "Pro Monat",
    };
  } catch (e) {
    return { id: "elevenlabs", name: "ElevenLabs", ok: false, error: (e as Error).message };
  }
}

async function probeDeepl(key: string): Promise<Result> {
  const base = key.endsWith(":fx") ? "https://api-free.deepl.com/v2" : "https://api.deepl.com/v2";
  try {
    const r = await fetch(`${base}/usage`, { headers: { Authorization: `DeepL-Auth-Key ${key}` } });
    if (!r.ok) return { id: "deepl", name: "DeepL", ok: false, error: `HTTP ${r.status}` };
    const j: any = await r.json();
    return {
      id: "deepl", name: "DeepL", ok: true,
      used: j.character_count, limit: j.character_limit,
      remaining: j.character_limit - j.character_count,
      unit: "chars", note: "Pro Monat",
    };
  } catch (e) {
    return { id: "deepl", name: "DeepL", ok: false, error: (e as Error).message };
  }
}

async function probeReplicate(key: string): Promise<Result> {
  try {
    const r = await fetch("https://api.replicate.com/v1/account", { headers: { Authorization: `Token ${key}` } });
    if (!r.ok) return { id: "replicate", name: "Replicate", ok: false, error: `HTTP ${r.status}` };
    const j: any = await r.json();
    return { id: "replicate", name: "Replicate", ok: true, note: `Account ${j.username}` };
  } catch (e) {
    return { id: "replicate", name: "Replicate", ok: false, error: (e as Error).message };
  }
}

async function probeStability(key: string): Promise<Result> {
  try {
    const r = await fetch("https://api.stability.ai/v1/user/balance", { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return { id: "stability", name: "Stability AI", ok: false, error: `HTTP ${r.status}` };
    const j: any = await r.json();
    return { id: "stability", name: "Stability AI", ok: true, remaining: Math.round(j.credits), unit: "credits" };
  } catch (e) {
    return { id: "stability", name: "Stability AI", ok: false, error: (e as Error).message };
  }
}

async function probeResend(key: string): Promise<Result> {
  try {
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return { id: "resend", name: "Resend", ok: false, error: `HTTP ${r.status}` };
    return { id: "resend", name: "Resend", ok: true, note: "Aktiv (Quota nur im Dashboard)" };
  } catch (e) {
    return { id: "resend", name: "Resend", ok: false, error: (e as Error).message };
  }
}

async function probeHuggingFace(key: string): Promise<Result> {
  try {
    const r = await fetch("https://huggingface.co/api/whoami-v2", { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return { id: "huggingface", name: "Hugging Face", ok: false, error: `HTTP ${r.status}` };
    const j: any = await r.json();
    return { id: "huggingface", name: "Hugging Face", ok: true, note: `${j.name ?? "User"} · ${j.plan ?? "Free"}` };
  } catch (e) {
    return { id: "huggingface", name: "Hugging Face", ok: false, error: (e as Error).message };
  }
}

async function probeOpenWeather(key: string): Promise<Result> {
  try {
    const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Berlin&appid=${encodeURIComponent(key)}`);
    if (!r.ok) return { id: "openweather", name: "OpenWeather", ok: false, error: `HTTP ${r.status}` };
    return { id: "openweather", name: "OpenWeather", ok: true, note: "1000 Calls/Tag (Free)" };
  } catch (e) {
    return { id: "openweather", name: "OpenWeather", ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ error: "Nicht angemeldet" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("llm_api_key, huggingface_key, elevenlabs_key, deepl_key, replicate_key, stability_key, resend_api_key, openweather_key, whisper_key")
    .eq("id", user.id).single();
  if (!profile) return json({ error: "Profil nicht gefunden" }, 404);

  // Parallel-Abfrage
  const tasks: Promise<Result>[] = [];
  if (profile.llm_api_key)      tasks.push(probeLlm(profile.llm_api_key));
  if (profile.huggingface_key)  tasks.push(probeHuggingFace(profile.huggingface_key));
  if (profile.elevenlabs_key)   tasks.push(probeElevenlabs(profile.elevenlabs_key));
  if (profile.deepl_key)        tasks.push(probeDeepl(profile.deepl_key));
  if (profile.replicate_key)    tasks.push(probeReplicate(profile.replicate_key));
  if (profile.stability_key)    tasks.push(probeStability(profile.stability_key));
  if (profile.resend_api_key)   tasks.push(probeResend(profile.resend_api_key));
  if (profile.openweather_key)  tasks.push(probeOpenWeather(profile.openweather_key));
  // Whisper teilt sich oft den Groq/OpenAI-Key; separat nur wenn anders
  if (profile.whisper_key && profile.whisper_key !== profile.llm_api_key) {
    tasks.push(probeLlm(profile.whisper_key).then(r => ({ ...r, id: "whisper_" + r.id, name: r.name + " (Whisper)" })));
  }

  const providers = await Promise.all(tasks);
  return json({ providers, checked_at: new Date().toISOString() });
});
