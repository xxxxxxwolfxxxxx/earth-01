// Mail-Versand via Resend. Free-Tier: 3000 Mails/Monat.

export interface MailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

// Default Sender: onboarding@resend.dev (Resends Shared-Tester). Funktioniert nur,
// wenn die Empfänger-Mail = die Mail des Resend-Accounts ist. Für echte Mails an
// fremde Empfänger braucht der User eine verifizierte Domain bei Resend.
const DEFAULT_FROM = "Earth 0.1 Bot <onboarding@resend.dev>";

export async function sendMail(args: {
  to: string;
  subject: string;
  body: string;
  resendKey: string;
  from?: string;
}): Promise<MailResult> {
  if (!args.resendKey) return { ok: false, error: "Kein Resend-Key" };
  if (!args.to || !args.subject || !args.body) {
    return { ok: false, error: "to/subject/body erforderlich" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.to)) {
    return { ok: false, error: "Empfänger ist keine gültige Mail-Adresse" };
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: args.from || DEFAULT_FROM,
        to: [args.to],
        subject: args.subject,
        text: args.body,
      }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { ok: false, error: j?.message || `Resend ${r.status}` };
    }
    return { ok: true, messageId: j.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
