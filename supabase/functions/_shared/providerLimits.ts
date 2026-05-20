// Reset-Schedules der Free-Tier-Provider + Quota-Probe-Logik.

export type ProviderId = 'groq' | 'openrouter' | 'nvidia' | 'openai' | 'anthropic'
  | 'huggingface' | 'elevenlabs' | 'deepl' | 'resend' | 'replicate';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  resetWindow: 'daily' | 'monthly' | 'continuous';
  harvestHourUtc: number;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  groq:        { id: 'groq',        name: 'Groq',        resetWindow: 'daily',      harvestHourUtc: 23 },
  openrouter:  { id: 'openrouter',  name: 'OpenRouter',  resetWindow: 'continuous', harvestHourUtc: 23 },
  nvidia:      { id: 'nvidia',      name: 'NVIDIA',      resetWindow: 'monthly',    harvestHourUtc: 23 },
  openai:      { id: 'openai',      name: 'OpenAI',      resetWindow: 'daily',      harvestHourUtc: 23 },
  anthropic:   { id: 'anthropic',   name: 'Anthropic',   resetWindow: 'daily',      harvestHourUtc: 23 },
  huggingface: { id: 'huggingface', name: 'HuggingFace', resetWindow: 'daily',      harvestHourUtc: 23 },
  elevenlabs:  { id: 'elevenlabs',  name: 'ElevenLabs',  resetWindow: 'monthly',    harvestHourUtc: 23 },
  deepl:       { id: 'deepl',       name: 'DeepL',       resetWindow: 'monthly',    harvestHourUtc: 23 },
  resend:      { id: 'resend',      name: 'Resend',      resetWindow: 'monthly',    harvestHourUtc: 23 },
  replicate:   { id: 'replicate',   name: 'Replicate',   resetWindow: 'continuous', harvestHourUtc: 23 },
};

export function detectLlmProvider(key: string): ProviderId | null {
  if (key.startsWith('gsk_'))    return 'groq';
  if (key.startsWith('sk-or-'))  return 'openrouter';
  if (key.startsWith('nvapi-'))  return 'nvidia';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-'))     return 'openai';
  return null;
}

export function isHarvestWindow(date = new Date()): boolean {
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  return h === 23 && m >= 30 && m < 58;
}

export function isMonthlyHarvestDay(date = new Date()): boolean {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.getUTCDate() === 1;
}

export async function probeLlmRemaining(key: string): Promise<number | null> {
  const p = detectLlmProvider(key);
  if (!p) return null;
  const baseUrl =
    p === 'groq'        ? 'https://api.groq.com/openai/v1' :
    p === 'openrouter'  ? 'https://openrouter.ai/api/v1' :
    p === 'nvidia'      ? 'https://integrate.api.nvidia.com/v1' :
    p === 'openai'      ? 'https://api.openai.com/v1' :
    null;
  if (!baseUrl) return null;
  try {
    const r = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return null;
    const remT = r.headers.get('x-ratelimit-remaining-tokens');
    const limT = r.headers.get('x-ratelimit-limit-tokens');
    if (remT && limT && Number(limT) > 0) {
      return Math.round((Number(remT) / Number(limT)) * 100);
    }
    return 50;
  } catch {
    return null;
  }
}
