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

// HF Inference über den aktuellen Router-Endpunkt (router.huggingface.co).
// Der alte api-inference.huggingface.co-Endpunkt ist für Bild-Modelle tot.
const HF_MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-xl-base-1.0",
];

async function genHF(prompt: string, key: string): Promise<ImageGenResult> {
  let lastErr = "";
  for (const model of HF_MODELS) {
    try {
      const r = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt }),
      });
      const ct = r.headers.get("content-type") ?? "";
      if (r.ok && ct.includes("image")) {
        return { ok: true, blob: await r.blob(), provider: "huggingface", model };
      }
      // Fehlerursache für die Diagnose mitnehmen
      const body = await r.text().catch(() => "");
      lastErr = `${model.split("/").pop()}: HTTP ${r.status}${body ? " " + body.slice(0, 120) : ""}`;
    } catch (e) {
      lastErr = `${model.split("/").pop()}: ${(e as Error).message}`;
    }
  }
  return { ok: false, error: lastErr };
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
