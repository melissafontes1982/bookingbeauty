import { buildPushPayload } from "@block65/webcrypto-web-push";
import { VAPID_PUBLIC_KEY } from "./push-config";

export type PushResult = {
  ok: boolean;
  reason?: "no-private-key" | "no-public-key" | "no-subscriptions" | "failed";
  sent: number;
  failed: number;
  detail?: string;
};

/** Envia uma notificação a todos os aparelhos registados. Nunca lança erro; devolve um resumo. */
export async function notifyProfessionals(title: string, body: string): Promise<PushResult> {
  try {
    const privateKey = process.env["VAPID_PRIVATE_KEY"];
    if (!privateKey) return { ok: false, reason: "no-private-key", sent: 0, failed: 0 };
    if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "no-public-key", sent: 0, failed: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth");
    if (!subs?.length) return { ok: false, reason: "no-subscriptions", sent: 0, failed: 0 };

    const vapid = {
      // A Apple exige um contacto válido (mailto: ou https:). Pode ser trocado com VAPID_SUBJECT.
      subject: process.env["VAPID_SUBJECT"] ?? "mailto:notificacoes@bookingbeauty.app",
      publicKey: VAPID_PUBLIC_KEY,
      privateKey,
    };
    const data = JSON.stringify({ title, body, url: "/painel" });

    const results = await Promise.allSettled(
      subs.map(async (s) => {
        const payload = await buildPushPayload(
          { data, options: { ttl: 86400, urgency: "high" } },
          { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
          vapid,
        );
        const res = await fetch(s.endpoint, payload);
        if (res.status === 404 || res.status === 410) {
          // Aparelho que já não existe: limpa o registo.
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;
    const firstError = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (firstError) console.error("push: falha no envio", firstError.reason);
    return {
      ok: sent > 0,
      ...(sent === 0 ? { reason: "failed" as const } : {}),
      sent,
      failed,
      ...(firstError ? { detail: String((firstError.reason as Error)?.message ?? firstError.reason) } : {}),
    };
  } catch (e) {
    console.error("push failed", e);
    return { ok: false, reason: "failed", sent: 0, failed: 0, detail: e instanceof Error ? e.message : String(e) };
  }
}
