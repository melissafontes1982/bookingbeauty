import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Clock,
  MessageCircle,
  Plus,
  Scissors,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { addDaysISO, buildWhatsAppLink, detectLang, formatPriceEUR, todayISO } from "@/lib/schedule";
import { NovaMarcacaoDialog } from "./NovaMarcacaoDialog";

export type DashboardTarget = "agenda" | "servicos" | "clientes";

// Mesma chave usada na secção de lembretes da Agenda, para o "enviado" ser partilhado.
const SENT_KEY = "lembretes-enviados";

type Appointment = {
  id: string;
  client_name: string;
  client_phone: string;
  service_id: string | null;
  service_name: string;
  appointment_date: string;
  start_time: string;
  status: string;
  manage_token: string;
};

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Link que abre a conversa no WhatsApp, sem mensagem escrita. */
function chatLink(a: Appointment) {
  return buildWhatsAppLink({
    phone: a.client_phone,
    clientName: a.client_name,
    serviceName: a.service_name,
    date: a.appointment_date,
    time: a.start_time.slice(0, 5),
    kind: "confirm",
  }).split("?")[0] as string;
}

function messageParams(a: Appointment, kind: "confirm" | "remind") {
  return {
    phone: a.client_phone,
    clientName: a.client_name,
    serviceName: a.service_name,
    date: a.appointment_date,
    time: a.start_time.slice(0, 5),
    kind,
    lang: detectLang(a.client_phone),
    manageUrl: `${window.location.origin}/agendamento/${a.manage_token}`,
  };
}

export function DashboardPanel({ onNavigate }: { onNavigate: (target: DashboardTarget) => void }) {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = useMemo(() => {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${today.slice(0, 7)}-${String(last).padStart(2, "0")}`;
  }, [today]);

  const [newOpen, setNewOpen] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setSent(JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}"));
    } catch {
      setSent({});
    }
  }, []);

  const markSent = (id: string) => {
    const next = { ...sent, [id]: true };
    setSent(next);
    try {
      localStorage.setItem(SENT_KEY, JSON.stringify(next));
    } catch {
      /* sem armazenamento disponível: só não fica guardado */
    }
  };

  const { data: settings } = useQuery({
    queryKey: ["general-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_settings")
        .select("company_name, business_segment, logo_url")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ["dash-services-prices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, price");
      if (error) throw error;
      return data;
    },
  });

  const { data: clientCount } = useQuery({
    queryKey: ["clients", "count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("clients").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: monthAppointments } = useQuery({
    queryKey: ["appointments", "dash-month", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, status, service_id")
        .gte("appointment_date", monthStart)
        .lte("appointment_date", monthEnd);
      if (error) throw error;
      return data;
    },
  });

  const { data: todayList } = useQuery({
    queryKey: ["appointments", "dash-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("appointment_date", today)
        .neq("status", "cancelado")
        .order("start_time");
      if (error) throw error;
      return data as Appointment[];
    },
  });

  const { data: tomorrowList } = useQuery({
    queryKey: ["appointments", "dash-tomorrow", tomorrow],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("appointment_date", tomorrow)
        .neq("status", "cancelado")
        .order("start_time");
      if (error) throw error;
      return data as Appointment[];
    },
  });

  const { data: upcoming } = useQuery({
    queryKey: ["appointments", "dash-upcoming", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gt("appointment_date", today)
        .neq("status", "cancelado")
        .order("appointment_date")
        .order("start_time")
        .limit(5);
      if (error) throw error;
      return data as Appointment[];
    },
  });

  const priceById = useMemo(
    () => new Map((services ?? []).map((s) => [s.id, Number(s.price)])),
    [services],
  );
  const priceOf = (serviceId: string | null) => (serviceId ? (priceById.get(serviceId) ?? 0) : 0);

  // "Realizado" = marcações concluídas. "Previsto" = todas as não canceladas.
  const totals = useMemo(() => {
    const sum = (list: { status: string; service_id: string | null }[], onlyDone: boolean) =>
      list
        .filter((a) => a.status !== "cancelado" && (!onlyDone || a.status === "concluido"))
        .reduce((acc, a) => acc + priceOf(a.service_id), 0);
    const month = monthAppointments ?? [];
    const day = month.filter((a) => a.appointment_date === today);
    return {
      dayDone: sum(day, true),
      dayExpected: sum(day, false),
      monthDone: sum(month, true),
      monthExpected: sum(month, false),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthAppointments, priceById, today]);

  const pendingReminders = (tomorrowList ?? []).filter((a) => !sent[a.id]).length;
  const companyName = settings?.company_name ?? "Studio Eleve";
  const ready = monthAppointments !== undefined && services !== undefined;
  const money = (v: number) => (ready ? formatPriceEUR(v) : "—");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-foreground/60">Visão geral do {companyName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<CalendarDays className="size-5" aria-hidden="true" />}
          value={todayList ? String(todayList.length) : "—"}
          label="Agendamentos hoje"
        />
        <StatCard
          icon={<TrendingUp className="size-5" aria-hidden="true" />}
          value={money(totals.dayDone)}
          label="Faturamento hoje"
          hint={ready ? `Previsto: ${formatPriceEUR(totals.dayExpected)}` : undefined}
          tone="warm"
        />
        <StatCard
          icon={<Users className="size-5" aria-hidden="true" />}
          value={clientCount !== undefined ? String(clientCount) : "—"}
          label="Total de clientes"
        />
        <StatCard
          icon={<TrendingUp className="size-5" aria-hidden="true" />}
          value={money(totals.monthDone)}
          label="Faturamento do mês"
          hint={ready ? `Previsto: ${formatPriceEUR(totals.monthExpected)}` : undefined}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm"
        >
          <Plus className="size-4" aria-hidden="true" /> Novo agendamento
        </button>
        <button
          type="button"
          onClick={() => onNavigate("servicos")}
          className="glass-soft inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-foreground/80"
        >
          <Scissors className="size-4" aria-hidden="true" /> Gerenciar serviços
        </button>
        <button
          type="button"
          onClick={() => onNavigate("clientes")}
          className="glass-soft inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-foreground/80"
        >
          <Users className="size-4" aria-hidden="true" /> Gerenciar clientes
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          icon={<Clock className="size-4" aria-hidden="true" />}
          title="Agenda de hoje"
          action={
            <button
              type="button"
              onClick={() => onNavigate("agenda")}
              className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-foreground/60"
            >
              Ver agenda <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          }
        >
          {!todayList ? (
            <Empty>A carregar…</Empty>
          ) : todayList.length === 0 ? (
            <Empty>Sem atendimentos hoje.</Empty>
          ) : (
            <ul className="space-y-2">
              {todayList.map((a) => (
                <li key={a.id} className="glass-soft flex items-center gap-3 rounded-2xl p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.client_name}</p>
                    <p className="truncate text-xs text-foreground/60">{a.service_name}</p>
                  </div>
                  <span className="font-display text-base font-semibold">{a.start_time.slice(0, 5)}</span>
                  <WhatsAppIcon href={chatLink(a)} label={`Abrir WhatsApp de ${a.client_name}`} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          icon={<Bell className="size-4" aria-hidden="true" />}
          title="Lembretes de amanhã"
          action={
            tomorrowList && tomorrowList.length > 0 ? (
              <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-semibold">
                {pendingReminders}
              </span>
            ) : null
          }
        >
          {!tomorrowList ? (
            <Empty>A carregar…</Empty>
          ) : tomorrowList.length === 0 ? (
            <Empty>Nenhum atendimento amanhã.</Empty>
          ) : (
            <ul className="space-y-2">
              {tomorrowList.map((a) => (
                <li key={a.id} className="glass-soft flex items-center gap-3 rounded-2xl p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.client_name}</p>
                    <p className="truncate text-xs text-foreground/60">
                      {a.service_name} · {a.start_time.slice(0, 5)}
                    </p>
                  </div>
                  <a
                    href={buildWhatsAppLink(messageParams(a, "remind"))}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => markSent(a.id)}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold ${
                      sent[a.id] ? "bg-foreground/10 text-foreground/60" : "bg-[#25D366] text-white"
                    }`}
                  >
                    <MessageCircle className="size-4" aria-hidden="true" />
                    {sent[a.id] ? "Enviado" : "Lembrete"}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card icon={<CalendarDays className="size-4" aria-hidden="true" />} title="Próximos agendamentos">
        {!upcoming ? (
          <Empty>A carregar…</Empty>
        ) : upcoming.length === 0 ? (
          <Empty>Sem marcações futuras.</Empty>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((a) => (
              <li key={a.id} className="glass-soft flex items-center gap-3 rounded-2xl p-3">
                <div className="w-12 shrink-0 text-center leading-tight">
                  <p className="text-xs text-foreground/60">{ddmm(a.appointment_date)}</p>
                  <p className="font-display text-base font-semibold">{a.start_time.slice(0, 5)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.client_name}</p>
                  <p className="truncate text-xs text-foreground/60">
                    {a.service_name} · {formatPriceEUR(priceOf(a.service_id))}
                  </p>
                </div>
                <WhatsAppIcon
                  href={buildWhatsAppLink(messageParams(a, "confirm"))}
                  label={`Enviar confirmação a ${a.client_name}`}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <NovaMarcacaoDialog open={newOpen} onOpenChange={setNewOpen} defaultDate={today} onCreated={() => {}} />
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  hint,
  tone,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  hint?: string | undefined;
  tone?: "warm";
}) {
  return (
    <div className="glass-soft rounded-2xl p-4">
      <span
        className={`grid size-10 place-items-center rounded-full ${
          tone === "warm" ? "bg-amber-500/15 text-amber-700" : "bg-primary/10 text-brand-deep"
        }`}
      >
        {icon}
      </span>
      <p className="mt-3 font-display text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-foreground/60">{label}</p>
      {hint ? <p className="mt-1 text-[11px] text-foreground/45">{hint}</p> : null}
    </div>
  );
}

function Card({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="glass rounded-3xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="text-brand-deep">{icon}</span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-xs text-foreground/60">{children}</p>;
}

function WhatsAppIcon({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-full text-[#25D366] hover:bg-foreground/5"
    >
      <MessageCircle className="size-5" aria-hidden="true" />
    </a>
  );
}
