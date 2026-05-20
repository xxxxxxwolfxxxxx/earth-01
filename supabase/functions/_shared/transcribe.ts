// Sprachnachricht von Telegram herunterladen und mit Whisper transkribieren.
// Bevorzugt der gespeicherte whisper_key, fällt auf llm_api_key (Groq) zurück.

export interface TranscribeResult {
  ok: boolean;
  text?: string;
  error?: string;
}

function detectWhisperEndpoint(key: string): { url: string; model: string } | null {
  if (!key) return null;
  if (key.startsWith("gsk_")) {
    return {
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      model: "whisper-large-v3",
    };
  }
  if (key.startsWith("sk-")) {
    return {
      url: "https://api.openai.com/v1/audio/transcriptions",
      model: "whisper-1",
    };
  }
  return null;
}

// Holt das Telegram-File via getFile + Direkt-Download
async function downloadTelegramFile(botToken: string, fileId: string): Promise<Blob> {
  const meta = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const j = await meta.json();
  if (!j.ok) throw new Error(`getFile: ${j.description || "unknown"}`);
  const filePath = j.result.file_path;
  const data = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!data.ok) throw new Error(`fileDownload ${data.status}`);
  return await data.blob();
}

// Sendet die Audio-Datei an die Whisper-API und gibt den Transkript-Text zurück
async function whisperTranscribe(audioBlob: Blob, key: string, mimeType: string): Promise<TranscribeResult> {
  const endpoint = detectWhisperEndpoint(key);
  if (!endpoint) return { ok: false, error: "Whisper-Key-Prefix nicht erkannt (erwarte gsk_ oder sk-)" };

  // Telegram Voice ist .oga (OGG Opus). Whisper-APIs akzeptieren das.
  const form = new FormData();
  form.append("file", audioBlob, `voice.${mimeType?.includes("ogg") ? "ogg" : "mp3"}`);
  form.append("model", endpoint.model);
  form.append("language", "de");
  form.append("response_format", "json");

  const r = await fetch(endpoint.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: body?.error?.message || `HTTP ${r.status}` };
  return { ok: true, text: body.text };
}

export async function transcribeTelegramVoice(opts: {
  botToken: string;
  voice: { file_id: string; mime_type?: string };
  whisperKey: string | null;
  llmKey: string | null;
}): Promise<TranscribeResult> {
  // Key bestimmen: bevorzugt whisper_key, sonst llm_api_key (falls Groq)
  const key = opts.whisperKey
    || (opts.llmKey && (opts.llmKey.startsWith("gsk_") || opts.llmKey.startsWith("sk-")) ? opts.llmKey : null);
  if (!key) {
    return { ok: false, error: "Kein Whisper-Key gespeichert. Hinterleg einen unter /keys (Groq-Whisper ist gratis)." };
  }

  try {
    const blob = await downloadTelegramFile(opts.botToken, opts.voice.file_id);
    return await whisperTranscribe(blob, key, opts.voice.mime_type || "audio/ogg");
  } catch (e) {
    return { ok: false, error: e.message ?? String(e) };
  }
}
