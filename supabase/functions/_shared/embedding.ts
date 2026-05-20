// Embedding-Berechnung via Hugging Face Inference API.
// Modell: intfloat/multilingual-e5-small (384-dim, mehrsprachig inkl. Deutsch).

const HF_MODEL = "intfloat/multilingual-e5-small";
const HF_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`;

async function embed(text: string, hfKey: string): Promise<number[]> {
  if (!hfKey) throw new Error("Kein Hugging-Face-Key");
  if (!text || !text.trim()) throw new Error("Leerer Text");

  const r = await fetch(HF_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: text,
      options: { wait_for_model: true },
    }),
  });
  if (!r.ok) throw new Error(`HF embed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const vec: number[] = Array.isArray(j?.[0]) ? j[0] : j;
  if (!Array.isArray(vec) || vec.length !== 384) {
    throw new Error(`Unerwartete HF-Antwort, Länge ${vec?.length}`);
  }
  return vec;
}

// e5-Konvention: Anfragen kriegen "query: " prefix, Dokumente "passage: "
export async function embedQuery(text: string, hfKey: string): Promise<number[]> {
  return embed("query: " + text, hfKey);
}

export async function embedPassage(text: string, hfKey: string): Promise<number[]> {
  return embed("passage: " + text, hfKey);
}
