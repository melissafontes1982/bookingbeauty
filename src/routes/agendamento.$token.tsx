import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getPublicSiteInfo } from "@/lib/public-site.functions";
import { themeToCssVars } from "@/lib/theme";
import { LangSwitch, longDate, useLang, weekdayShort } from "@/lib/i18n";
import {
  cancelManagedBooking,
  getManagedBooking,
  getRescheduleSlots,
  rescheduleManagedBooking,
} from "@/lib/booking.functions";
import { addDaysISO, formatLongDateBR, todayISO, WEEKDAY_SHORT, weekdayOfDate } from "@/lib/schedule";

export const Route = createFileRoute("/agendamento/$token")({
  head: () => ({
    meta: [
      { title: "Gerenciar agendamento" },
      { name: "description", content: "Cancele ou reagende o seu horário com segurança." },
      { property: "og:title", content: "Gerenciar agendamento" },
      { property: "og:description", content: "Cancele ou reagende o seu horário com segurança." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManagePage,
});

type Booking = {
  serviceName: string;
  date: string;
  time: string;
  status: string;
  name: string;
  past: boolean;
};

function ManagePage() {
  const lang = useLang();
  const L = (pt: string, en: string) => (lang === "en" ? en : pt);
  const { token } = Route.useParams();
  const getFn = useServerFn(getManagedBooking);
  const cancelFn = useServerFn(cancelManagedBooking);
  const slotsFn = useServerFn(getRescheduleSlots);
  const rescheduleFn = useServerFn(rescheduleManagedBooking);

  const [last4, setLast4] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState<string | null>(null);

  const siteInfoFn = useServerFn(getPublicSiteInfo);
  const { data: siteInfo } = useQuery({
    queryKey: ["public-site-info"],
    queryFn: () => siteInfoFn(),
  });
  const settings = siteInfo?.settings ?? null;

  const slots = useQuery({
    queryKey: ["reschedule-slots", token, date],
    enabled: mode === "reschedule" && !!booking,
    queryFn: () => slotsFn({ data: { token, phoneLast4: last4, date } }),
  });

  const load = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await getFn({ data: { token, phoneLast4: last4 } });
      if (r.ok) setBooking(r.booking);
      else setError(r.error);
    } catch {
      setError(L("Link inválido ou dados incorretos.", "Invalid link or incorrect details."));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!window.confirm(L("Tem certeza que deseja cancelar este agendamento?", "Are you sure you want to cancel this booking?"))) return;
    setBusy(true);
    setError(null);
    const r = await cancelFn({ data: { token, phoneLast4: last4 } });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setNotice(L("Agendamento cancelado. Esperamos ver você em breve!", "Booking cancelled. We hope to see you soon!"));
    await load();
  };

  const reschedule = async () => {
    if (!time) return;
    setBusy(true);
    setError(null);
    const r = await rescheduleFn({ data: { token, phoneLast4: last4, date, time } });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      void slots.refetch();
      return;
    }
    setNotice(lang === "en" ? `Rescheduled to ${longDate(lang, date)} at ${time}.` : `Reagendado para ${longDate(lang, date)} às ${time}.`);
    setMode("view");
    setTime(null);
    await load();
  };

  const days = Array.from({ length: 21 }, (_, i) => addDaysISO(todayISO(), i));
  const canChange = booking && booking.status !== "cancelado" && !booking.past;

  return (
    <div style={themeToCssVars(settings)} className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-xs">{settings?.company_name ?? "Studio Eleve"}</p>
          <LangSwitch />
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{L("Seu agendamento", "Your booking")}</h1>

        {!booking ? (
          <form
            className="glass mt-6 rounded-3xl p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <label className="text-sm font-semibold text-foreground/80" htmlFor="last4">
              {L("Para sua segurança, digite os 4 últimos dígitos do WhatsApp usado no agendamento", "For your security, enter the last 4 digits of the WhatsApp number used to book")}
            </label>
            <input
              id="last4"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
              className="mt-3 w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-center text-2xl tracking-[0.5em]"
            />
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={last4.length !== 4 || busy}
              className="mt-4 w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? L("Verificando…", "Checking…") : L("Ver agendamento", "View booking")}
            </button>
          </form>
        ) : (
          <div className="glass mt-6 rounded-3xl p-5">
            <p className="text-sm text-foreground/60">{L("Olá", "Hello")}, {booking.name}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{booking.serviceName}</p>
            <p className="text-sm text-foreground/70">
              {longDate(lang, booking.date)} {L("às", "at")} {booking.time}
            </p>
            <p className="mt-2 inline-block rounded-full bg-mist px-3 py-1 text-xs font-semibold capitalize">
              {lang === "en" ? ({ confirmado: "confirmed", cancelado: "cancelled", pendente: "pending", concluido: "completed" } as Record<string, string>)[booking.status] ?? booking.status : booking.status}
            </p>
            {notice && <p className="mt-3 text-sm font-semibold text-brand">{notice}</p>}
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            {booking.past && booking.status !== "cancelado" && (
              <p className="mt-3 text-sm text-foreground/60">{L("Este horário já passou.", "This appointment has already passed.")}</p>
            )}

            {canChange && mode === "view" && (
              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setMode("reschedule");
                  }}
                  className="rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground"
                >
                  {L("Reagendar", "Reschedule")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cancel()}
                  className="rounded-xl border border-destructive/40 py-3.5 text-base font-semibold text-destructive"
                >
                  {L("Cancelar agendamento", "Cancel booking")}
                </button>
              </div>
            )}

            {canChange && mode === "reschedule" && (
              <div className="mt-5">
                <p className="text-sm font-semibold">{L("Escolha o novo dia", "Choose the new day")}</p>
                <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-2">
                  {days.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDate(d);
                        setTime(null);
                      }}
                      className={`min-w-14 shrink-0 rounded-xl px-2 py-2 text-center text-xs ${
                        d === date ? "bg-primary text-primary-foreground" : "glass-soft"
                      }`}
                    >
                      <span className="block">{weekdayShort(lang, weekdayOfDate(d))}</span>
                      <span className="block text-base font-semibold">{d.slice(8, 10)}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm font-semibold">{L("Horários livres", "Available times")}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {slots.isLoading && <p className="col-span-3 text-sm text-foreground/60">{L("Carregando…", "Loading…")}</p>}
                  {slots.data?.slots.length === 0 && (
                    <p className="col-span-3 text-sm text-foreground/60">{L("Sem horários neste dia.", "No times on this day.")}</p>
                  )}
                  {slots.data?.slots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTime(s)}
                      className={`rounded-xl py-3 text-sm font-semibold ${
                        s === time ? "bg-primary text-primary-foreground" : "glass-soft"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    disabled={!time || busy}
                    onClick={() => void reschedule()}
                    className="rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? L("Salvando…", "Saving…") : L("Confirmar novo horário", "Confirm new time")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("view")}
                    className="glass-soft rounded-xl py-3 text-sm font-semibold"
                  >
                    {L("Voltar", "Back")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <a href="/" className="mt-6 block text-center text-sm text-foreground/60 underline">
          {L("Fazer novo agendamento", "Make a new booking")}
        </a>
      </div>
    </div>
  );
}
