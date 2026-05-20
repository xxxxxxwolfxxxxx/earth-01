// Text-to-Speech via ElevenLabs Multilingual V2.
// Liefert MP3-Blob (Telegram nimmt das mit sendAudio entgegen).

export interface TtsResult {
  ok: boolean;
  blob?: Blob;
  error?: string;
}

// Default-Voice: "Rachel" (de+en, neutral). User-Override via profiles.elevenlabs_voice_id möglich.
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";
const MODEL = "eleven_multilingual_v2";

export async function synthesize(text: string, key: string, voiceId?: string): Promise<TtsResult> {
  if (!key) return { ok: false, error: "Kein ElevenLabs-Key" };
  if (!text || !text.trim()) return { ok: false, error: "Leerer Text" };

  // Telegram-Limit für sendAudio ist 50 MB, MP3 mit 128kbit/s entspricht das ~50 Min.
  // ElevenLabs schluckt aber 5000 Zeichen pro Call. Wir kürzen auf 2000 für Voice-Notes.
  const clipped = text.slice(0, 2000);

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId || DEFAULT_VOICE}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: clipped,
        model_id: MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });
    if (!r.ok) {
      const errBody = await r.text();
      return { ok: false, error: `ElevenLabs ${r.status}: ${errBody.slice(0, 200)}` };
    }
    const blob = await r.blob();
    return { ok: true, blob };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
