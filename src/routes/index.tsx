import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { themeToCssVars } from "@/lib/theme";
import { createPublicBooking, getAvailableSlots } from "@/lib/booking.functions";
import { getPublicSiteInfo } from "@/lib/public-site.functions";
import { ServiceAdvisor } from "@/components/ServiceAdvisor";
import {
  addDaysISO,
  buildContactWhatsAppLink,
  formatLongDateBR,
  formatPriceEUR,
  todayISO,
  WEEKDAY_SHORT,
  weekdayOfDate,
  COUNTRY_CODES,
  detectLang,
} from "@/lib/schedule";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agendar online — Studio Eleve" },
      {
        name: "description",
        content:
          "Escolha seu serviço, veja os horários livres e agende em poucos cliques. Confirmação pelo WhatsApp.",
      },
      { property: "og:title", content: "Agendar online — Studio Eleve" },
      {
        property: "og:description",
        content: "Agenda online com horários em tempo real e confirmação pelo WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookingPage,
});

type Booking = Awaited<ReturnType<typeof createPublicBooking>>;

function BookingPage() {
  const slotsFn = useServerFn(getAvailableSlots);
  const bookFn = useServerFn(createPublicBooking);
  const siteInfoFn = useServerFn(getPublicSiteInfo);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(todayISO());
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("351");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [nif, setNif] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  const { data: services } = useQuery({
    queryKey: ["public-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: siteInfo } = useQuery({
    queryKey: ["public-site-info"],
    queryFn: () => siteInfoFn(),
  });
  const settings = siteInfo?.settings ?? null;

  const companyName = settings?.company_name ?? "Studio Eleve";
  const segment = settings?.business_segment?.trim() || "Estética e bem-estar";
  const contactLink = buildContactWhatsAppLink(settings?.whatsapp_number ?? "");

  const [weekStart, setWeekStart] = useState(() => todayISO());
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)),
    [weekStart],
  );
  const canGoBack = weekStart > todayISO();
  const monthLabel = useMemo(() => {
    const [y, m] = days[3].split("-").map(Number);
    const label = new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("pt-PT", {
      month: "long",
      year: "numeric",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [days]);

  const openWeekdays = useMemo(
    () => new Set(siteInfo?.openWeekdays ?? []),
    [siteInfo],
  );

  const { data: slotData, isFetching: loadingSlots } = useQuery({
    queryKey: ["slots", serviceId, date],
    enabled: Boolean(serviceId),
    queryFn: () => {
      if (!serviceId) return Promise.resolve({ slots: [] as string[] });
      return slotsFn({ data: { serviceId, date } });
    },
  });

  const selectedService = (services ?? []).find((s) => s.id === serviceId) ?? null;
  const step = booking ? 4 : !serviceId ? 1 : !time ? 2 : 3;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!serviceId || !time) return;
    setSaving(true);
    setError(null);
    try {
      const fullPhone = `${countryCode}${phone.replace(/\D/g, "").replace(/^0+/, "")}`;
      const result = await bookFn({
        data: { serviceId, date, time, name, phone: fullPhone, notes, email, nif, birthDate },
      });
      setBooking(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível agendar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen text-foreground" style={themeToCssVars(settings)}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt={companyName}
                className="h-14 w-auto max-w-[120px] shrink-0 rounded-2xl object-contain sm:h-20 sm:max-w-[220px]"
              />
            ) : (
              <div className="glass grid size-12 shrink-0 place-items-center rounded-2xl sm:size-16">
                <span className="font-display text-2xl font-semibold text-brand-deep">
                  {companyName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                {companyName}
              </p>
              <p className="eyebrow mt-1.5 truncate text-xs tracking-wider sm:text-sm">{segment}</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            {contactLink ? (
              <a
                href={contactLink}
                target="_blank"
                rel="noreferrer"
                className="glass-soft whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold text-brand-deep transition-shadow hover:shadow-md"
              >
                Chame no WhatsApp
              </a>
            ) : null}

          </nav>
        </header>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="glass order-2 rounded-3xl p-5 sm:p-6 lg:order-1 lg:col-span-4">
            <p className="eyebrow">Como funciona</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
              Quatro passos calmos
            </h2>
            <ol className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-0 lg:space-y-3">
              {["Escolha o serviço", "Escolha dia e horário", "Seus dados de contato", "Confirmação"].map(
                (label, index) => (
                  <li
                    key={label}
                    className={`glass-soft flex items-center gap-2 rounded-2xl p-3 sm:gap-3 sm:p-4 ${
                      step === index + 1 ? "ring-2 ring-brand/40" : ""
                    }`}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-semibold text-brand-deep">
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold">{label}</p>
                  </li>
                ),
              )}
            </ol>
            <div className="glass-soft mt-5 rounded-2xl p-4">
              <p className="eyebrow">Horário de funcionamento</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground/70">
                {(siteInfo?.hours ?? [])
                  .slice()
                  .sort((a, b) => a.weekday - b.weekday)
                  .map((s) => (
                    <li key={s.weekday} className="flex justify-between">
                      <span>{WEEKDAY_SHORT[s.weekday]}</span>
                      <span>
                        {s.is_open
                          ? `${s.open_time.slice(0, 5)} – ${s.close_time.slice(0, 5)}`
                          : "Fechado"}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </aside>

          <main className="glass order-1 rounded-3xl p-5 sm:p-7 lg:order-2 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">{segment}</p>
                <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{companyName}</h1>
                <p className="mt-1 text-sm text-foreground/60">Reserve seu momento de cuidado e bem-estar.</p>
              </div>
              <span className="glass-soft rounded-full px-3 py-1.5 text-xs font-medium text-foreground/60">
                Passo {step} de 4
              </span>
            </div>

            {booking ? (
              <Confirmation booking={booking} countryCode={countryCode} businessPhone={settings?.whatsapp_number ?? ""} onReset={() => {
                setBooking(null);
                setServiceId(null);
                setTime(null);
                setName("");
                setPhone("");
                setNotes("");
                setEmail("");
                setNif("");
                setBirthDate("");
              }} />
            ) : (
              <>
                <section className="mt-6">
                  <p className="text-sm font-semibold text-foreground/80">Escolha o serviço</p>
                  <ServiceAdvisor
                    onPick={(id) => {
                      setServiceId(id);
                      setTime(null);
                    }}
                  />
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(services ?? []).map((service) => {
                      const selected = service.id === serviceId;
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => {
                            setServiceId(service.id);
                            setTime(null);
                          }}
                          className={`rounded-2xl p-4 text-left transition-shadow ${
                            selected
                              ? "bg-primary text-primary-foreground shadow-lg"
                              : "glass-soft hover:shadow-md"
                          }`}
                        >
                          <p className="text-sm font-semibold">{service.name}</p>
                          <p
                            className={`mt-1 text-xs ${
                              selected ? "text-primary-foreground/70" : "text-foreground/50"
                            }`}
                          >
                            {service.duration_min}min
                          </p>
                          <p className="mt-3 font-display text-lg font-semibold">
                            {formatPriceEUR(Number(service.price))}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="mt-6">
                  <p className="text-sm font-semibold text-foreground/80">Escolha o dia e horário</p>
                  <div className="scrollbar-none -mx-5 mt-3 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
                    {days.map((day) => {
                      const selected = day === date;
                      const closed = !openWeekdays.has(weekdayOfDate(day));
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={closed}
                          onClick={() => {
                            setDate(day);
                            setTime(null);
                          }}
                          className={`w-16 shrink-0 rounded-2xl p-3 text-center transition-shadow sm:w-auto sm:shrink ${
                            selected
                              ? "bg-primary text-primary-foreground shadow-lg"
                              : closed
                                ? "glass-soft opacity-40"
                                : "glass-soft hover:shadow-md"
                          }`}
                        >
                          <p
                            className={`text-[11px] uppercase tracking-wide ${
                              selected ? "text-primary-foreground/70" : "text-foreground/50"
                            }`}
                          >
                            {WEEKDAY_SHORT[weekdayOfDate(day)]}
                          </p>
                          <p className="font-display text-lg font-semibold">{day.slice(8)}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
                    {!serviceId ? (
                      <p className="col-span-full text-sm text-foreground/50">
                        Selecione um serviço para ver os horários livres.
                      </p>
                    ) : loadingSlots ? (
                      <p className="col-span-full text-sm text-foreground/50">Buscando horários…</p>
                    ) : (slotData?.slots.length ?? 0) === 0 ? (
                      <p className="col-span-full text-sm text-foreground/50">
                        Nenhum horário livre neste dia. Tente outra data.
                      </p>
                    ) : (
                      (slotData?.slots ?? []).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setTime(slot)}
                          className={`rounded-xl py-3 text-center text-sm font-medium transition-shadow sm:py-2.5 ${
                            slot === time
                              ? "bg-primary font-semibold text-primary-foreground shadow-lg"
                              : "glass-soft text-foreground/70 hover:shadow-md"
                          }`}
                        >
                          {slot}
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <form onSubmit={handleSubmit} className="glass-soft mt-6 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-foreground/80">Seus dados</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Primeiro e último nome"
                      autoComplete="name"
                      className="rounded-xl border border-border bg-input px-4 py-3 text-base outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring sm:text-sm"
                    />
                    <div className="flex gap-2">
                      <select
                        aria-label="Código do país"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="rounded-xl border border-border bg-input px-2 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code + c.name} value={c.code}>
                            {c.flag} +{c.code}
                          </option>
                        ))}
                      </select>
                      <input
                        required
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="WhatsApp (ex.: 912 345 678)"
                        autoComplete="tel-national"
                        inputMode="tel"
                        className="min-w-0 flex-1 rounded-xl border border-border bg-input px-4 py-3 text-base outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring sm:text-sm"
                      />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="O seu e-mail"
                      autoComplete="email"
                      className="rounded-xl border border-border bg-input px-4 py-3 text-base outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring sm:text-sm"
                    />
                    <input
                      value={nif}
                      onChange={(e) => setNif(e.target.value)}
                      placeholder="NIF (opcional)"
                      inputMode="numeric"
                      className="rounded-xl border border-border bg-input px-4 py-3 text-base outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring sm:text-sm"
                    />
                    <label className="text-xs text-foreground/60 sm:col-span-2">
                      Data de nascimento (opcional)
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-border bg-input px-4 py-3 text-base text-foreground outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                      />
                    </label>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações (opcional)"
                    rows={2}
                    className="mt-3 w-full rounded-xl border border-border bg-input px-4 py-3 text-base outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring sm:text-sm"
                  />

                  {selectedService && time ? (
                    <p className="mt-3 text-xs text-foreground/60">
                      {selectedService.name} · {formatLongDateBR(date)} às {time} ·{" "}
                      {formatPriceEUR(Number(selectedService.price))}
                    </p>
                  ) : null}
                  {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

                  <button
                    type="submit"
                    disabled={!serviceId || !time || saving}
                    className="mt-4 w-full rounded-xl bg-primary py-3.5 text-center text-base font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 disabled:opacity-40 sm:py-3 sm:text-sm"
                  >
                    {saving ? "Confirmando…" : "Confirmar agendamento"}
                  </button>
                </form>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Confirmation({
  booking,
  businessPhone,
  countryCode,
  onReset,
}: {
  booking: Booking;
  countryCode: string;
  businessPhone: string;
  onReset: () => void;
}) {
  const en = detectLang(`${countryCode}000000000`) === "en";
  const message = en
    ? `Hello! I just booked an appointment on the website:\n` +
      `• *Service:* ${booking.serviceName}\n` +
      `• *Date:* ${booking.date.split("-").reverse().join("/")} at ${booking.time}\n` +
      `• *My name:* ${booking.name}\n` +
      `Could you please confirm?`
    : `Olá! Acabei de agendar um horário pelo site:\n` +
    `• *Serviço:* ${booking.serviceName}\n` +
    `• *Data:* ${formatLongDateBR(booking.date)} às ${booking.time}\n` +
    `• *Meu nome:* ${booking.name}\n` +
    `Poderia confirmar, por favor?`;
  const link = buildContactWhatsAppLink(businessPhone, message);
  const manageUrl = `/agendamento/${booking.token}`;

  return (
    <div className="glass-soft mt-6 rounded-2xl p-5">
      <p className="text-sm font-semibold text-foreground/80">Agendamento confirmado</p>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {booking.serviceName}
      </p>
      <p className="text-sm text-foreground/60">
        {formatLongDateBR(booking.date)} às {booking.time} · {formatPriceEUR(booking.price)}
      </p>
      <div className="mt-4 whitespace-pre-line rounded-xl border border-border bg-mist/70 p-4 text-sm leading-relaxed text-foreground/70">
        “{message.replace(/\*/g, "")}”
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-xl bg-primary py-3 text-center text-sm font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
          >
            Avisar o profissional no WhatsApp
          </a>
        ) : null}
        <a
          href={manageUrl}
          className="glass-soft rounded-xl px-5 py-3 text-center text-sm font-semibold text-foreground/70"
        >
          Cancelar ou reagendar
        </a>
        <button
          type="button"
          onClick={onReset}
          className="glass-soft rounded-xl px-5 py-3 text-sm font-semibold text-foreground/70"
        >
          Novo agendamento
        </button>
      </div>
    </div>
  );
}
