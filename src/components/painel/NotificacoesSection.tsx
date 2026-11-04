import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY } from "@/lib/push-config";
import { sendTestPush } from "@/lib/push.functions";

function urlB64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function NotificacoesSection() {
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const testFn = useServerFn(sendTestPush);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.getRegistration("/push-sw.js").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setActive(!!sub && Notification.permission === "granted");
    });
  }, []);

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Permissão negada. Ative as notificações nas definições do navegador.");
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC_KEY) }));
      const j = sub.toJSON();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("push_subscriptions").upsert(
        { user_id: u.user.id, endpoint: sub.endpoint, p256dh: j.keys!["p256dh"]!, auth: j.keys!["auth"]! },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
      setActive(true);
      setMsg("Notificações ativadas neste aparelho.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível ativar.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setActive(false);
    setBusy(false);
    setMsg("Notificações desativadas neste aparelho.");
  };

  const test = async () => {
    setBusy(true);
    await testFn().catch(() => null);
    setBusy(false);
    setMsg("Notificação de teste enviada.");
  };

  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="text-lg font-semibold">Notificações no telemóvel</h3>
      <p className="text-sm text-muted-foreground">
        Receba um aviso quando um cliente marcar ou cancelar, mesmo com o site fechado. No iPhone, adicione primeiro o
        site ao ecrã principal (Partilhar → Adicionar ao Ecrã Principal) e ative a partir de lá.
      </p>
      {!supported ? (
        <p className="text-sm text-destructive">Este navegador não suporta notificações.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {active ? (
            <>
              <button disabled={busy} onClick={test} className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
                Enviar teste
              </button>
              <button disabled={busy} onClick={disable} className="rounded-lg border border-border px-4 py-3 text-sm disabled:opacity-50">
                Desativar neste aparelho
              </button>
            </>
          ) : (
            <button disabled={busy} onClick={enable} className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
              Ativar notificações neste telemóvel
            </button>
          )}
        </div>
      )}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </section>
  );
}
