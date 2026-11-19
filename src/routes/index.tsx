import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { themeToCssVars } from "@/lib/theme";
import { createPublicBooking, notifyNewBooking } from "@/lib/booking.functions";
import { LangSwitch, longDate, useLang, weekdayShort, type Lang } from "@/lib/i18n";
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

type Booking = Awaited<ReturnType<typeof createPublicBooking>> & { professionalPhone?: string | null };

function BookingPage() {
  const lang = useLang();
  const L = (pt: string, en: string) => (lang === "en" ? en : pt);
  const notifyFn = useServerFn(notifyNewBooking);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: professionals } = useQuery({ queryKey: ["public-professionals"], queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_professionals" as never);
      if (error) throw error;
      return ((data as unknown) ?? []) as { id: string; name: string; bio: string | null; photo_url: string | null; serviceIds: string[] }[];
    } });
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
    queryFn: async () => {
      {
        const [{ data: s }, { data: sch }] = await Promise.all([
          supabase
            .from("general_settings")
            .select(
              "company_name, business_segment, whatsapp_number, logo_url, theme_primary, theme_button, theme_button_text, theme_text, theme_background",
            )
            .eq("id", 1)
            .maybeSingle(),
          supabase.from("schedule_settings").select("weekday, is_open, open_time, close_time"),
        ]);
        return {
          settings: s ?? null,
          openWeekdays: (sch ?? []).filter((x) => x.is_open).map((x) => x.weekday),
          hours: sch ?? [],
        };
      }
    },
  });
  const settings = siteInfo?.settings ?? null;

  const companyName = settings?.company_name ?? "Studio Eleve";
  const segment = settings?.business_segment?.trim() || L("Estética e bem-estar", "Beauty & wellness");
  const contactLink = buildContactWhatsAppLink(settings?.whatsapp_number ?? "");

  const [weekStart, setWeekStart] = useState(() => todayISO());
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)),
    [weekStart],
  );
  const canGoBack = weekStart > todayISO();
  const monthLabel = useMemo(() => {
    const [y = 2026, m = 1] = (days[3] ?? weekStart).split("-").map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString(lang === "en" ? "en-GB" : "pt-PT", {
      month: "long",
      year: "numeric",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [days, weekStart, lang]);

  const openWeekdays = useMemo(
    () => new Set(siteInfo?.openWeekdays ?? []),
    [siteInfo],
  );

  const servicePros = (professionals ?? []).filter((p) => serviceId && p.serviceIds.includes(serviceId));
  const needsPro = servicePros.length > 0;
  // Se o serviço só tem um profissional, fica selecionado e o cliente vai direto para o dia e hora.
  const autoPro = servicePros.length === 1 ? (servicePros[0] ?? null) : null;
  const activeProId = professionalId ?? autoPro?.id ?? null;
  const { data: slotData, isFetching: loadingSlots } = useQuery({
    queryKey: ["slots", serviceId, date, activeProId],
    enabled: Boolean(serviceId) && (!needsPro || Boolean(activeProId)),
    queryFn: async () => {
      if (!serviceId) return { slots: [] as string[] };
      const { data, error } = await supabase.rpc("public_available_slots", {
        _service_id: serviceId,
        _date: date,
        ...(activeProId ? { _professional_id: activeProId } : {}),
      });
      if (error) throw error;
      return { slots: (data ?? []) as string[] };
    },
  });

  const selectedService = (services ?? []).find((s) => s.id === serviceId) ?? null;
  const step = booking ? 4 : !serviceId ? 1 : !time ? 2 : 3;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!serviceId || !time || (needsPro && !activeProId)) return;
    setSaving(true);
    setError(null);
    try {
      const fullPhone = `${countryCode}${phone.replace(/\D/g, "").replace(/^0+/, "")}`;
      const { data: rpcData, error: rpcError } = await supabase.rpc("public_create_booking", {
        _service_id: serviceId,
        _professional_id: (activeProId ?? null) as unknown as string,
        _date: date,
        _time: time,
        _name: name,
        _phone: fullPhone,
        ...(notes ? { _notes: notes } : {}),
        ...(email ? { _email: email } : {}),
        ...(nif ? { _nif: nif } : {}),
        ...(birthDate ? { _birth_date: birthDate } : {}),
      });
      if (rpcError) throw new Error(rpcError.message);
      const result = rpcData as unknown as Booking;
      setBooking({ ...result, price: Number(result.price) });
      notifyFn({ data: { title: "🔔 Nova marcação", body: `${result.name} marcou ${result.serviceName}${result.professionalName ? ` com ${result.professionalName}` : ""} para ${date.slice(8, 10)}/${date.slice(5, 7)} às ${time}.` } }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : L("Não foi possível agendar.", "Could not complete the booking."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen text-foreground" style={themeToCssVars(settings)}>
      {/* Acesso discreto ao painel, no canto inferior direito */}
      <Link
        to="/auth"
        aria-label={L("Acesso ao painel", "Staff login")}
        title={L("Acesso ao painel", "Staff login")}
        className="glass fixed bottom-4 right-4 z-50 grid size-11 place-items-center rounded-full text-foreground/60 shadow-lg transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <Lock className="size-5" aria-hidden="true" />
      </Link>
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
            <LangSwitch />
            {contactLink ? (
              <a
                href={contactLink}
                target="_blank"
                rel="noreferrer"
                className="glass-soft whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold text-brand-deep transition-shadow hover:shadow-md"
              >
                {L("Chame no WhatsApp", "Message us on WhatsApp")}
              </a>
            ) : null}

          </nav>
        </header>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="glass order-2 rounded-3xl p-5 sm:p-6 lg:order-1 lg:col-span-4">
            <p className="eyebrow">{L("Como funciona", "How it works")}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
              {L("Quatro passos calmos", "Four easy steps")}
            </h2>
            <ol className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-0 lg:space-y-3">
              {(lang === "en" ? ["Choose a service", "Choose date & time", "Your contact details", "Confirmation"] : ["Escolha o serviço", "Escolha dia e horário", "Seus dados de contato", "Confirmação"]).map(
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
              <p className="eyebrow">{L("Horário de funcionamento", "Opening hours")}</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground/70">
                {(siteInfo?.hours ?? [])
                  .slice()
                  .sort((a, b) => a.weekday - b.weekday)
                  .map((s) => (
                    <li key={s.weekday} className="flex justify-between">
                      <span>{weekdayShort(lang, s.weekday)}</span>
                      <span>
                        {s.is_open
                          ? `${s.open_time.slice(0, 5)} – ${s.close_time.slice(0, 5)}`
                          : L("Fechado", "Closed")}
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
                <p className="mt-1 text-sm text-foreground/60">{L("Reserve seu momento de cuidado e bem-estar.", "Book your moment of care and wellbeing.")}</p>
              </div>
              <span className="glass-soft rounded-full px-3 py-1.5 text-xs font-medium text-foreground/60">
                {L("Passo", "Step")} {step} {L("de", "of")} 4
              </span>
            </div>

            {booking ? (
              <Confirmation lang={lang} booking={booking} countryCode={countryCode} businessPhone={settings?.whatsapp_number ?? ""} onReset={() => {
                setBooking(null);
                setServiceId(null);
                setProfessionalId(null);
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
                  <p className="text-sm font-semibold text-foreground/80">{L("Escolha o serviço", "Choose a service")}</p>
                  {contactLink ? (
                    <p className="mt-1 text-xs text-foreground/60">
                      {L("Em dúvida sobre qual serviço escolher?", "Not sure which service to choose?")}{" "}
                      <a
                        href={buildContactWhatsAppLink(
                          settings?.whatsapp_number ?? "",
                          L(
                            "Olá! Tenho uma dúvida sobre qual serviço escolher.",
                            "Hello! I have a question about which service to choose.",
                          ),
                        ) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand-deep underline underline-offset-2"
                      >
                        {L("Fale conosco no WhatsApp", "Message us on WhatsApp")}
                      </a>
                    </p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
                    {(services ?? []).map((service) => {
                      const selected = service.id === serviceId;
                      const title = (lang === "en" && service.name_en) || service.name;
                      const desc = ((lang === "en" && service.description_en) || service.description || "").trim();
                      const canExpand = desc.length > 70 || desc.includes("\n");
                      const expanded = expandedId === service.id;
                      const muted = selected ? "text-primary-foreground/80" : "text-foreground/65";
                      return (
                        <div
                          key={service.id}
                          className={`overflow-hidden rounded-2xl transition-shadow ${
                            selected ? "bg-primary text-primary-foreground shadow-lg" : "glass-soft hover:shadow-md"
                          }`}
                        >
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              setServiceId(service.id);
                              setProfessionalId(null);
                              setTime(null);
                            }}
                            className="block w-full px-4 pb-2 pt-4 text-left"
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span className="text-sm font-semibold leading-snug">{title}</span>
                              <span className="shrink-0 font-display text-base font-semibold">
                                {formatPriceEUR(Number(service.price))}
                              </span>
                            </span>
                            <span
                              className={`mt-0.5 block text-xs ${
                                selected ? "text-primary-foreground/70" : "text-foreground/50"
                              }`}
                            >
                              {service.duration_min} min
                            </span>
                          </button>
                          {desc ? (
                            canExpand ? (
                              <button
                                type="button"
                                aria-expanded={expanded}
                                onClick={() => setExpandedId(expanded ? null : service.id)}
                                className="flex min-h-11 w-full items-start gap-2 px-4 pb-3 pt-1 text-left"
                              >
                                <span
                                  className={`flex-1 whitespace-pre-line text-xs leading-relaxed ${muted} ${
                                    expanded ? "" : "line-clamp-2"
                                  }`}
                                >
                                  {desc}
                                </span>
                                <span className="sr-only">
                                  {expanded ? L("Ocultar descrição", "Hide description") : L("Ver descrição completa", "Show full description")}
                                </span>
                                <ChevronDown
                                  aria-hidden="true"
                                  className={`mt-0.5 size-5 shrink-0 transition-transform ${muted} ${expanded ? "rotate-180" : ""}`}
                                />
                              </button>
                            ) : (
                              <p className={`whitespace-pre-line px-4 pb-3 pt-1 text-xs leading-relaxed ${muted}`}>{desc}</p>
                            )
                          ) : (
                            <div className="pb-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {autoPro ? (
                  <section className="mt-6">
                    <p className="text-sm font-semibold text-foreground/80">{L("Profissional", "Professional")}</p>
                    <div className="glass-soft mt-3 flex items-center gap-3 rounded-2xl p-3">
                      {autoPro.photo_url ? (
                        <img src={autoPro.photo_url} alt={autoPro.name} className="size-11 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 font-display text-base font-semibold text-brand-deep">
                          {autoPro.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 text-sm font-semibold">{autoPro.name}</span>
                    </div>
                  </section>
                ) : null}

                {needsPro && !autoPro ? (
                  <section className="mt-6">
                    <p className="text-sm font-semibold text-foreground/80">{L("Escolha o profissional", "Choose a professional")}</p>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {servicePros.map((p) => {
                        const selected = p.id === professionalId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setProfessionalId(p.id); setTime(null); }}
                            className={`flex items-center gap-3 rounded-2xl p-4 text-left transition-shadow ${selected ? "bg-primary text-primary-foreground shadow-lg" : "glass-soft hover:shadow-md"}`}
                          >
                            {p.photo_url ? (
                              <img src={p.photo_url} alt={p.name} className="size-14 shrink-0 rounded-full object-cover" />
                            ) : (
                            <span className={`grid size-14 shrink-0 place-items-center rounded-full font-display text-lg font-semibold ${selected ? "bg-primary-foreground/15" : "bg-brand/10 text-brand-deep"}`}>
                              {p.name.charAt(0).toUpperCase()}
                            </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">{p.name}</span>
                              {p.bio ? <span className={`block truncate text-xs ${selected ? "text-primary-foreground/70" : "text-foreground/50"}`}>{p.bio}</span> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                <section className="mt-6">
                  <p className="text-sm font-semibold text-foreground/80">{L("Escolha o dia e horário", "Choose date & time")}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={L("Semana anterior", "Previous week")}
                        disabled={!canGoBack}
                        onClick={() => {
                          const prev = addDaysISO(weekStart, -7);
                          setWeekStart(prev < todayISO() ? todayISO() : prev);
                        }}
                        className="glass-soft grid size-9 place-items-center rounded-full text-lg disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <span className="min-w-36 text-center font-display text-base font-semibold">{monthLabel}</span>
                      <button
                        type="button"
                        aria-label={L("Próxima semana", "Next week")}
                        onClick={() => setWeekStart(addDaysISO(weekStart, 7))}
                        className="glass-soft grid size-9 place-items-center rounded-full text-lg"
                      >
                        ›
                      </button>
                    </div>
                    <label className="glass-soft flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-foreground/70">
                      {L("Ir para data", "Go to date")}
                      <input
                        type="date"
                        min={todayISO()}
                        value={date}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v || v < todayISO()) return;
                          setWeekStart(v);
                          setDate(v);
                          setTime(null);
                        }}
                        className="bg-transparent text-sm text-foreground outline-none"
                      />
                    </label>
                  </div>
                  <div className="scrollbar-none -mx-5 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
                    {days.map((day) => {
                      const selected = day === date;
                      const today = todayISO();
                      const past = day < today;
                      const isToday = day === today;
                      const closed = !openWeekdays.has(weekdayOfDate(day));
                      const unavailable = past || closed;
                      const status = past ? L("Passado", "Past") : closed ? L("Fechado", "Closed") : isToday ? L("Hoje", "Today") : L("Livre", "Open");
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={unavailable}
                          aria-pressed={selected}
                          aria-label={`${weekdayShort(lang, weekdayOfDate(day))} ${day.slice(8)} — ${status}`}
                          onClick={() => {
                            setDate(day);
                            setTime(null);
                          }}
                          className={`flex min-h-[84px] w-[68px] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-2.5 text-center transition-all sm:w-auto sm:shrink ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                              : unavailable
                                ? "cursor-not-allowed border-dashed border-foreground/15 bg-muted/40 text-foreground/35"
                                : "glass-soft border-primary/25 text-foreground hover:border-primary/60 hover:shadow-md active:scale-[0.97]"
                          }`}
                        >
                          <span
                            className={`text-xs font-medium uppercase tracking-wide ${
                              selected ? "text-primary-foreground/80" : unavailable ? "" : "text-foreground/60"
                            }`}
                          >
                            {weekdayShort(lang, weekdayOfDate(day))}
                          </span>
                          <span className={`font-display text-xl font-semibold leading-none ${unavailable ? "line-through decoration-1" : ""}`}>
                            {day.slice(8)}
                          </span>
                          <span
                            className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              selected
                                ? "text-primary-foreground/90"
                                : unavailable
                                  ? ""
                                  : isToday
                                    ? "text-primary"
                                    : "text-primary/70"
                            }`}
                          >
                            {status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60">
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-primary/40 bg-background" />{L("Livre", "Open")}</span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" />{L("Selecionado", "Selected")}</span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-dashed border-foreground/30 bg-muted" />{L("Fechado / passado", "Closed / past")}</span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
                    {!serviceId ? (
                      <p className="col-span-full text-sm text-foreground/50">
                        {L("Selecione um serviço para ver os horários livres.", "Select a service to see available times.")}
                      </p>
                    ) : needsPro && !activeProId ? (
                      <p className="col-span-full text-sm text-foreground/50">
                        {L("Selecione um profissional acima para ver os horários disponíveis.", "Select a professional above to see available times.")}
                      </p>
                    ) : loadingSlots ? (
                      <p className="col-span-full text-sm text-foreground/50">{L("Buscando horários…", "Loading times…")}</p>
                    ) : (slotData?.slots.length ?? 0) === 0 ? (
                      <p className="col-span-full text-sm text-foreground/50">
                        {L("Nenhum horário livre neste dia. Tente outra data.", "No free times on this day. Try another date.")}
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
                  <p className="text-sm font-semibold text-foreground/80">{L("Seus dados", "Your details")}</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={L("Primeiro e último nome", "First and last name")}
                      autoComplete="name"
                      className="rounded-xl border border-border bg-input px-4 py-3 text-base outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring sm:text-sm"
                    />
                    <div className="flex gap-2">
                      <select
                        aria-label={L("Código do país", "Country code")}
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
                        placeholder={L("WhatsApp (ex.: 912 345 678)", "WhatsApp (e.g. 912 345 678)")}
                        autoComplete="tel-national"
                        inputMode="tel"
                        className="min-w-0 flex-1 rounded-xl border border-border bg-input px-4 py-3 text-base outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring sm:text-sm"
                      />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={L("O seu e-mail", "Your e-mail")}
                      autoComplete="email"
                      className="rounded-xl border border-border bg-input px-4 py-3 text-base outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring sm:text-sm"
                    />
                    <input
                      value={nif}
                      onChange={(e) => setNif(e.target.value)}
                      placeholder={L("NIF (opcional)", "Tax number / NIF (optional)")}
                      inputMode="numeric"
                      className="rounded-xl border border-border bg-input px-4 py-3 text-base outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring sm:text-sm"
                    />
                    <label className="text-xs text-foreground/60 sm:col-span-2">
                      {L("Data de nascimento (opcional)", "Date of birth (optional)")}
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
                    placeholder={L("Observações (opcional)", "Notes (optional)")}
                    rows={2}
                    className="mt-3 w-full rounded-xl border border-border bg-input px-4 py-3 text-base outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring sm:text-sm"
                  />

                  {selectedService && time ? (
                    <p className="mt-3 text-xs text-foreground/60">
                      {(lang === "en" && selectedService.name_en) || selectedService.name} · {longDate(lang, date)} {L("às", "at")} {time} ·{" "}
                      {formatPriceEUR(Number(selectedService.price))}
                    </p>
                  ) : null}
                  {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

                  <button
                    type="submit"
                    disabled={!serviceId || !time || saving}
                    className="mt-4 w-full rounded-xl bg-primary py-3.5 text-center text-base font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 disabled:opacity-40 sm:py-3 sm:text-sm"
                  >
                    {saving ? L("Confirmando…", "Confirming…") : L("Confirmar agendamento", "Confirm booking")}
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
  lang,
  booking,
  businessPhone,
  countryCode,
  onReset,
}: {
  lang: Lang;
  booking: Booking;
  countryCode: string;
  businessPhone: string;
  onReset: () => void;
}) {
  const en = lang === "en" || detectLang(`${countryCode}000000000`) === "en";
  const L = (pt: string, en2: string) => (lang === "en" ? en2 : pt);
  const message = en
    ? `Hello! I just booked an appointment on the website:\n` +
      `• *Service:* ${booking.serviceName}\n` +
      (booking.professionalName ? `• *Professional:* ${booking.professionalName}\n` : "") +
      `• *Date:* ${booking.date.split("-").reverse().join("/")} at ${booking.time}\n` +
      `• *My name:* ${booking.name}\n` +
      `Could you please confirm?`
    : `Olá! Acabei de agendar um horário pelo site:\n` +
    `• *Serviço:* ${booking.serviceName}\n` +
    (booking.professionalName ? `• *Profissional:* ${booking.professionalName}\n` : "") +
    `• *Data:* ${formatLongDateBR(booking.date)} às ${booking.time}\n` +
    `• *Meu nome:* ${booking.name}\n` +
    `Poderia confirmar, por favor?`;
  const link = buildContactWhatsAppLink(booking.professionalPhone || businessPhone, message);
  const manageUrl = `/agendamento/${booking.token}`;

  return (
    <div className="glass-soft mt-6 rounded-2xl p-5">
      <p className="text-sm font-semibold text-foreground/80">{L("Agendamento confirmado", "Booking confirmed")}</p>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {booking.serviceName}
      </p>
      {booking.professionalName ? (
        <p className="text-sm text-foreground/70">{L("com", "with")} {booking.professionalName}</p>
      ) : null}
      <p className="text-sm text-foreground/60">
        {longDate(lang, booking.date)} {L("às", "at")} {booking.time} · {formatPriceEUR(booking.price)}
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
            {L("Avisar o profissional no WhatsApp", "Notify the professional on WhatsApp")}
          </a>
        ) : null}
        <a
          href={manageUrl}
          className="glass-soft rounded-xl px-5 py-3 text-center text-sm font-semibold text-foreground/70"
        >
          {L("Cancelar ou reagendar", "Cancel or reschedule")}
        </a>
        <button
          type="button"
          onClick={onReset}
          className="glass-soft rounded-xl px-5 py-3 text-sm font-semibold text-foreground/70"
        >
          {L("Novo agendamento", "New booking")}
        </button>
      </div>
    </div>
  );
}
