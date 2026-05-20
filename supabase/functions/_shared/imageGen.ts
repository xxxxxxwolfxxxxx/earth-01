// Bild-Generation. Default: HF Inference (FLUX.1-schnell, gratis).
// Optional: Replicate wenn Key vorhanden (höhere Qualität).

export interface ImageGenArgs {
  prompt: string;
  hfKey?: string;
  replicateKey?: string;
}

export interface ImageGenResult {
  ok: boolean;
  blob?: Blob;
  provider?: string;
  model?: string;
  error?: string;
}

// HF Inference: FLUX.1-schnell ist sehr schnell und auf der gratis Inference-API
const HF_MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/sdxl-turbo",
  "stabilityai/stable-diffusion-xl-base-1.0",
];

async function genHF(prompt: string, key: string): Promise<ImageGenResult> {
  for (const model of HF_MODELS) {
    try {
      const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          options: { wait_for_model: true },
        }),
      });
      if (!r.ok) continue;
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("image")) continue;
      const blob = await r.blob();
      return { ok: true, blob, provider: "huggingface", model };
    } catch {
      continue;
    }
  }
  return { ok: false, error: "Kein HF-Modell hat geantwortet (Quota oder Modell offline)" };
}

// Replicate: höhere Qualität, kostet Credits.
async function genReplicate(prompt: string, key: string): Promise<ImageGenResult> {
  try {
    // Sync create
    const createRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({ input: { prompt, num_outputs: 1, aspect_ratio: "1:1" } }),
    });
    const cj: any = await createRes.json();
    if (!createRes.ok) return { ok: false, error: cj?.detail || `Replicate ${createRes.status}` };
    const url = Array.isArray(cj.output) ? cj.output[0] : cj.output;
    if (!url) return { ok: false, error: "Replicate hat keine URL geliefert" };
    const imgRes = await fetch(url);
    if (!imgRes.ok) return { ok: false, error: `Replicate-Download ${imgRes.status}` };
    const blob = await imgRes.blob();
    return { ok: true, blob, provider: "replicate", model: "flux-schnell" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function generateImage(args: ImageGenArgs): Promise<ImageGenResult> {
  // Bevorzugt Replicate (Qualität), fällt auf HF zurück (gratis).
  if (args.replicateKey) {
    const r = await genReplicate(args.prompt, args.replicateKey);
    if (r.ok) return r;
    // Fallback bei Fehler
  }
  if (args.hfKey) {
    return await genHF(args.prompt, args.hfKey);
  }
  return { ok: false, error: "Weder Hugging-Face- noch Replicate-Key gespeichert" };
}
