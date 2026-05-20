// Quality-Score-Berechnung. Wird vom Worker NACH der Generierung gerufen.
// Nutzt denselben User-LLM für den Selbst-Check (1 zusätzlicher Call).

export interface ScoreResult {
  total: number;          // 0-100
  factual: number;        // 0-30
  language: number;       // 0-30
  noPromo: number;        // 0-40
  reasoning: string;
  rejected: boolean;      // true wenn promo erkannt oder gesamtscore < 40
}

// Regex-basierter Promo-Filter (schnell, kostet keine Tokens)
const PROMO_PATTERNS = [
  /\bkaufe?n? jetzt\b/i,
  /\b(discount|rabatt|sale|coupon|gutschein)\b/i,
  /\b(affiliate|werb(?:e|ung))\b/i,
  /\bhttps?:\/\/[^\s]*ref=[a-z0-9]+/i,
  /\b(bestelle?n? hier|jetzt zugreifen|nicht verpassen)\b/i,
];

export function hasPromoMarkers(text: string): boolean {
  return PROMO_PATTERNS.some(re => re.test(text));
}

export async function scoreContent(args: {
  text: string;
  topic: string;
  factualSeed?: string;
  llmBaseUrl: string;
  llmKey: string;
  llmModel: string;
}): Promise<ScoreResult> {
  // 1. Promo-Regex
  if (hasPromoMarkers(args.text)) {
    return {
      total: 0, factual: 0, language: 0, noPromo: 0,
      reasoning: 'Werbliche Phrasen oder Affiliate-Links erkannt.',
      rejected: true,
    };
  }

  // 2. LLM-Self-Score
  const prompt = `Bewerte den folgenden Plattform-Beitrag streng.

Thema: ${args.topic}
${args.factualSeed ? `Faktischer Seed (Wahrheit): ${args.factualSeed}` : ''}

Beitrag:
${args.text}

Antworte als JSON mit:
{
  "factual": 0-30,     // Faktentreue (auch gegenüber Seed wenn da)
  "language": 0-30,    // Sprache, Stil, Klarheit
  "noPromo": 0-40,     // Frei von Werbung/Affiliate/Ich-Form
  "reasoning": "..."
}`;
  try {
    const r = await fetch(`${args.llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.llmKey}` },
      body: JSON.stringify({
        model: args.llmModel,
        messages: [
          { role: 'system', content: 'Du bewertest streng und ehrlich. Antworte ausschließlich als valides JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
    const j = await r.json();
    const raw = j?.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    const f = clamp(Number(parsed.factual) || 0, 0, 30);
    const l = clamp(Number(parsed.language) || 0, 0, 30);
    const p = clamp(Number(parsed.noPromo) || 0, 0, 40);
    const total = f + l + p;
    return {
      total, factual: f, language: l, noPromo: p,
      reasoning: String(parsed.reasoning ?? ''),
      rejected: total < 40,
    };
  } catch (e) {
    // Wenn Score-LLM fehlschlägt: pessimistisch, Score 40 (Grenzfall, nicht verworfen)
    return {
      total: 40, factual: 12, language: 12, noPromo: 16,
      reasoning: 'Score-LLM-Call fehlgeschlagen, neutral angenommen.',
      rejected: false,
    };
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
