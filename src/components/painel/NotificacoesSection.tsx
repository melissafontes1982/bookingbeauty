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

const KEY_INVALID =
  "A chave VITE_VAPID_PUBLIC_KEY no Vercel não é válida. Confirme que copiou o valor completo, sem espaços.";

/** Uma chave pública VAPID válida tem 65 bytes e começa por 0x04. */
function vapidKeyProblem(): string | null {
  if (!VAPID_PUBLIC_KEY) {
    return "As notificações ainda não estão configuradas neste site: falta a variável VITE_VAPID_PUBLIC_KEY no Vercel (e um Redeploy).";
  }
  try {
    const bytes = urlB64ToUint8(VAPID_PUBLIC_KEY);
    if (bytes.length !== 65 || bytes[0] !== 4) return KEY_INVALID;
  } catch {
    return KEY_INVALID;
  }
  return null;
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function friendlyError(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "NotAllowedError") {
      return "Permissão negada. No iPhone: Definições → Notificações → Studio Eleve → Permitir notificações. Depois volte a tentar.";
    }
    if (e.name === "AbortError" || e.name === "InvalidAccessError" || /applicationServerKey|P-256|pattern/i.test(e.message)) {
      return `A chave de notificações do site não é aceite (${e.name}). Confirme a variável VITE_VAPID_PUBLIC_KEY no Vercel.`;
    }
    if (e.name === "Error" || e.name === "TypeError") return e.message;
    return `Não foi possível ativar (${e.name}: ${e.message}).`;
  }
  return "Não foi possível ativar.";
}

export function NotificacoesSection() {
  const [supported, setSupported] = useState(true);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [keyProblem, setKeyProblem] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const testFn = useServerFn(sendTestPush);

  const say = (text: string, error = false) => {
    setMsg(text);
    setIsError(error);
  };

  useEffect(() => {
    setKeyProblem(vapidKeyProblem());
    // No iPhone, as notificações só existem quando o site é aberto pelo ícone no ecrã principal.
    if (isIOS() && !isStandalone()) {
      setNeedsInstall(true);
      setSupported(false);
      return;
    }
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
      const problem = vapidKeyProblem();
      if (problem) throw new Error(problem);
      // O pedido de permissão tem de ser a primeira coisa a acontecer após o toque (regra do iPhone).
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        throw new Error(
          "Permissão não concedida. No iPhone: Definições → Notificações → Studio Eleve → Permitir notificações. Depois volte a tentar.",
        );
      }
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8(VAPID_PUBLIC_KEY),
        }));
      const j = sub.toJSON();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada. Entre novamente no painel.");
      const { error } = await supabase.from("push_subscriptions").upsert(
        { user_id: u.user.id, endpoint: sub.endpoint, p256dh: j.keys!["p256dh"]!, auth: j.keys!["auth"]! },
        { onConflict: "endpoint" },
      );
      if (error) throw new Error(`Não foi possível guardar o aparelho: ${error.message}`);
      setActive(true);
      say("Notificações ativadas neste aparelho. Toque em “Enviar teste” para confirmar.");
    } catch (e) {
      say(friendlyError(e), true);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setActive(false);
      say("Notificações desativadas neste aparelho.");
    } catch (e) {
      say(friendlyError(e), true);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await testFn();
      if (r.ok) {
        say(
          `Teste enviado para ${r.sent} aparelho(s)${r.failed ? ` (${r.failed} falharam)` : ""}. Se não aparecer, verifique as definições de notificações do telemóvel.`,
        );
      } else if (r.reason === "no-private-key") {
        say("Falta a variável VAPID_PRIVATE_KEY no Vercel (e um Redeploy).", true);
      } else if (r.reason === "no-public-key") {
        say("Falta a variável VITE_VAPID_PUBLIC_KEY no Vercel (e um Redeploy).", true);
      } else if (r.reason === "no-subscriptions") {
        say("Nenhum aparelho está registado. Desative e volte a ativar neste telemóvel.", true);
      } else {
        say(
          `O envio falhou${r.detail ? ` (${r.detail})` : ""}. Se persistir, desative e volte a ativar neste telemóvel.`,
          true,
        );
      }
    } catch (e) {
      say(`Não foi possível enviar o teste: ${e instanceof Error ? e.message : "erro desconhecido"}.`, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="text-lg font-semibold">Notificações no telemóvel</h3>
      <p className="text-sm text-muted-foreground">
        Receba um aviso quando um cliente marcar ou cancelar, mesmo com o site fechado.
      </p>

      {keyProblem ? <p className="text-sm text-destructive">{keyProblem}</p> : null}

      {needsInstall ? (
        <div className="space-y-2 rounded-lg bg-foreground/5 p-3 text-sm">
          <p className="font-semibold">No iPhone, siga estes passos:</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              Abra o site no <strong>Safari</strong> (não funciona noutros navegadores nem dentro de outras apps).
            </li>
            <li>
              Toque no botão <strong>Partilhar</strong> (quadrado com uma seta) e escolha{" "}
              <strong>Adicionar ao Ecrã Principal</strong>.
            </li>
            <li>
              Feche o Safari e abra o painel pelo <strong>novo ícone</strong> no ecrã principal.
            </li>
            <li>Volte a esta página e toque em “Ativar notificações”.</li>
          </ol>
          <p className="text-xs text-muted-foreground">Requer iOS 16.4 ou mais recente.</p>
        </div>
      ) : !supported ? (
        <p className="text-sm text-destructive">Este navegador não suporta notificações.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {active ? (
            <>
              <button
                disabled={busy}
                onClick={test}
                className="min-h-11 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Enviar teste
              </button>
              <button
                disabled={busy}
                onClick={disable}
                className="min-h-11 rounded-lg border border-border px-4 py-3 text-sm disabled:opacity-50"
              >
                Desativar neste aparelho
              </button>
            </>
          ) : (
            <button
              disabled={busy || Boolean(keyProblem)}
              onClick={enable}
              className="min-h-11 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Ativar notificações neste telemóvel
            </button>
          )}
        </div>
      )}
      {msg ? <p className={`text-sm ${isError ? "text-destructive" : "text-muted-foreground"}`}>{msg}</p> : null}
    </section>
  );
}
