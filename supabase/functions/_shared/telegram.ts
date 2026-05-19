// Shared Telegram-Send-Helper für Edge Functions.
// Liest Bot-Token + Chat-ID aus profiles, ruft Telegram Bot API direkt auf.

export interface TelegramTarget {
  bot_token: string | null;
  chat_id: string | null;
}

export async function sendTelegramMessage(
  target: TelegramTarget,
  text: string
): Promise<boolean> {
  if (!target.bot_token || !target.chat_id) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${target.bot_token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: target.chat_id,
          text,
          parse_mode: "HTML",
        }),
      },
    );
    if (!res.ok) {
      console.warn("Telegram send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Telegram send exception:", (err as Error).message);
    return false;
  }
}

// Hilfsfunktion: Profile-Row enthält die Telegram-Felder bereits
export function targetFromProfile(profile: {
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
}): TelegramTarget {
  return {
    bot_token: profile.telegram_bot_token ?? null,
    chat_id: profile.telegram_chat_id ?? null,
  };
}
