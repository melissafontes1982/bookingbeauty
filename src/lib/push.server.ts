import { buildPushPayload } from "@block65/webcrypto-web-push";
import { VAPID_PUBLIC_KEY } from "./push-config";

/** Sends a push notification to every registered device. Never throws. */
export async function notifyProfessionals(title: string, body: string) {
  try {
    const privateKey = process.env["VAPID_PRIVATE_KEY"];
    if (!privateKey) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth");
    if (!subs?.length) return;
    const vapid = { subject: "mailto:notificacoes@bookingbeauty.app", publicKey: VAPID_PUBLIC_KEY, privateKey };
    const data = JSON.stringify({ title, body, url: "/painel" });
    await Promise.allSettled(
      subs.map(async (s) => {
        const payload = await buildPushPayload(
          { data, options: { ttl: 86400, urgency: "high" } },
          { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
          vapid,
        );
        const res = await fetch(s.endpoint, payload);
        if (res.status === 404 || res.status === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }),
    );
  } catch (e) {
    console.error("push failed", e);
  }
}
