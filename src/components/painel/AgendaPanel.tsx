import { useOneSession } from "@/components/painel/PacotesCliente";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { LembretesSection } from "./LembretesSection";
import { ExcluirOuRemarcarDialog, type RemarcarTarget } from "./ExcluirOuRemarcarDialog";
import { NovaMarcacaoDialog } from "./NovaMarcacaoDialog";
import { LangToggle } from "./LangToggle";
import { supabase } from "@/integrations/supabase/client";
import {
  detectLang,
  type MsgLang,
  addDaysISO,
  buildWhatsAppLink,
  buildSmsLink,
  formatLongDateBR,
  todayISO,
  weekdayOfDate,
  WEEKDAY_SHORT,
} from "@/lib/schedule";

type View = "dia" | "semana" | "mes";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function shiftMonth(iso: string, delta: number) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1 + delta;
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function AgendaPanel() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("dia");
  const [anchor, setAnchor] = useState(todayISO());
  const [langs, setLangs] = useState<Record<string, MsgLang>>({});
  const [newOpen, setNewOpen] = useState(false);
  const [target, setTarget] = useState<RemarcarTarget | null>(null);

  const range = useMemo(() => {
    if (view === "dia") return { from: anchor, to: anchor };
    if (view === "semana") {
      const start = addDaysISO(anchor, -weekdayOfDate(anchor));
      return { from: start, to: addDaysISO(start, 6) };
    }
    const first = `${anchor.slice(0, 7)}-01`;
    return { from: first, to: addDaysISO(addDaysISO(first, 31).slice(0, 8) + "01", -1) };
  }, [view, anchor]);

  const { data: appointments } = useQuery({
    queryKey: ["appointments", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("appointment_date", range.from)
        .lte("appointment_date", range.to)
        .order("appointment_date")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: blocks } = useQuery({
    queryKey: ["blocks", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_blocks")
        .select("*")
        .gte("block_date", range.from)
        .lte("block_date", range.to)
        .order("block_date");
      if (error) throw error;
      return data;
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "cancelado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const complete = useMutation({
    mutationFn: async (item: { id: string; client_id: string | null; service_name: string; appointment_date: string }) => {
      const { error } = await supabase.from("appointments").update({ status: "concluido" }).eq("id", item.id);
      if (error) throw error;
      if (!item.client_id) return;
      const { data: pkgs } = await supabase
        .from("client_packages")
        .select("id,name,total_sessions,used_sessions")
        .eq("client_id", item.client_id);
      const active = (pkgs ?? []).filter((p) => p.used_sessions < p.total_sessions);
      for (const p of active) {
        const left = p.total_sessions - p.used_sessions;
        if (window.confirm(`Abater 1 sessão do pacote "${p.name}"? (${left} restantes)`)) {
          await useOneSession(p.id, item.id, `${item.service_name} · ${item.appointment_date}`);
          window.alert(`Sessão abatida. Restam ${left - 1}.`);
          break;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["client-packages"] });
      queryClient.invalidateQueries({ queryKey: ["all-packages"] });
    },
    onError: (e) => window.alert((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
    onError: (e) => window.alert(`Não foi possível excluir: ${(e as Error).message}`),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof appointments>>();
    for (const item of appointments ?? []) {
      const list = map.get(item.appointment_date) ?? [];
      list.push(item);
      map.set(item.appointment_date, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [appointments]);

  return (
    <div className="space-y-6">
      <LembretesSection />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Painel do profissional</p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            {view === "dia"
              ? formatLongDateBR(anchor)
              : view === "mes"
                ? `${MONTHS[Number(anchor.slice(5, 7)) - 1]} de ${anchor.slice(0, 4)}`
                : `${range.from.slice(8)}/${range.from.slice(5, 7)} – ${range.to.slice(8)}/${range.to.slice(5, 7)}`}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm"
          >
            + Nova marcação
          </button>
          <button
            type="button"
            onClick={() => setAnchor(view === "mes" ? shiftMonth(anchor, -1) : addDaysISO(anchor, view === "dia" ? -1 : -7))}
            className="glass-soft rounded-xl px-3 py-2.5 text-xs font-semibold"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setAnchor(todayISO())}
            className="glass-soft rounded-xl px-3 py-2.5 text-xs font-semibold"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setAnchor(view === "mes" ? shiftMonth(anchor, 1) : addDaysISO(anchor, view === "dia" ? 1 : 7))}
            className="glass-soft rounded-xl px-3 py-2.5 text-xs font-semibold"
          >
            →
          </button>
          <div className="flex gap-1">
            {(["dia", "semana", "mes"] as View[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize ${
                  view === option
                    ? "bg-primary text-primary-foreground"
                    : "glass-soft text-foreground/70"
                }`}
              >
                {option === "mes" ? "mês" : option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(blocks ?? []).length > 0 ? (
        <div className="glass-soft rounded-2xl p-4">
          <p className="eyebrow">Bloqueios no período</p>
          <ul className="mt-2 space-y-1 text-xs text-foreground/70">
            {(blocks ?? []).map((block) => (
              <li key={block.id}>
                {formatLongDateBR(block.block_date)} · {block.start_time.slice(0, 5)}–
                {block.end_time.slice(0, 5)} · {block.reason ?? "Bloqueado"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {view === "mes" ? (
        <div className="glass rounded-3xl p-3 sm:p-4">
          <div className="grid grid-cols-7 pb-2 text-center text-xs font-semibold text-brand">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: weekdayOfDate(range.from) }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: Number(range.to.slice(8)) }).map((_, i) => {
              const day = `${range.from.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
              const items = (appointments ?? []).filter((a) => a.appointment_date === day);
              const blocked = (blocks ?? []).some((b) => b.block_date === day);
              const isToday = day === todayISO();
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setAnchor(day);
                    setView("dia");
                  }}
                  className={`flex min-h-24 flex-col gap-1 rounded-xl p-1.5 text-left transition hover:bg-brand/10 ${
                    isToday ? "border border-brand/50" : "border border-transparent"
                  }`}
                >
                  <span className={`text-xs ${isToday ? "font-bold text-brand-deep" : "text-foreground/60"}`}>
                    {i + 1}
                  </span>
                  {blocked ? (
                    <span className="truncate rounded bg-destructive/10 px-1 text-[10px] text-destructive">Bloqueio</span>
                  ) : null}
                  {items.slice(0, 3).map((a) => (
                    <span
                      key={a.id}
                      className={`truncate rounded px-1 text-[11px] font-medium ${
                        a.status === "cancelado"
                          ? "bg-destructive/10 text-destructive line-through"
                          : "bg-primary/15 text-brand-deep"
                      }`}
                    >
                      {a.start_time.slice(0, 5)} {a.client_name}
                    </span>
                  ))}
                  {items.length > 3 ? (
                    <span className="text-[10px] text-foreground/50">+{items.length - 3} mais</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : grouped.length === 0 ? (
        <p className="glass-soft rounded-2xl p-6 text-sm text-foreground/60">
          Nenhum atendimento neste período.
        </p>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day} className="space-y-3">
            <p className="eyebrow">
              {WEEKDAY_SHORT[weekdayOfDate(day)]} · {formatLongDateBR(day)}
            </p>
            {items.map((item) => (
              <div key={item.id} className="glass-soft rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{item.client_name}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.status === "cancelado"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-brand/15 text-brand-deep"
                    }`}
                  >
                    {item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground/60">
                  {item.service_name}{item.professional_name ? ` · com ${item.professional_name}` : ""} · {item.client_phone} · {item.status}
                </p>
                {item.notes ? (
                  <p className="mt-1 text-xs text-foreground/50">{item.notes}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <LangToggle
                    value={langs[item.id] ?? detectLang(item.client_phone)}
                    onChange={(l) => setLangs({ ...langs, [item.id]: l })}
                  />
                  <a
                    href={buildWhatsAppLink({
                      phone: item.client_phone,
                      clientName: item.client_name,
                      serviceName: item.service_name,
                      date: item.appointment_date,
                      time: item.start_time.slice(0, 5),
                      kind: item.status === "cancelado" ? "cancel" : "confirm",
                      lang: langs[item.id] ?? detectLang(item.client_phone),
                      ...(item.status === "cancelado"
                        ? {}
                        : { manageUrl: `${window.location.origin}/agendamento/${item.manage_token}` }),
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 basis-full rounded-xl bg-primary px-4 py-3 text-center text-xs font-semibold text-primary-foreground sm:flex-none sm:basis-auto sm:py-2"
                  >
                    {item.status === "cancelado"
                      ? "Avisar Cancelamento no WhatsApp"
                      : "Enviar Confirmação no WhatsApp"}
                  </a>
                  <a
                    href={buildSmsLink({
                      phone: item.client_phone,
                      clientName: item.client_name,
                      serviceName: item.service_name,
                      date: item.appointment_date,
                      time: item.start_time.slice(0, 5),
                      kind: item.status === "cancelado" ? "cancel" : "confirm",
                      lang: langs[item.id] ?? detectLang(item.client_phone),
                      ...(item.status === "cancelado"
                        ? {}
                        : { manageUrl: `${window.location.origin}/agendamento/${item.manage_token}` }),
                    })}
                    className="glass-soft flex-1 rounded-xl px-4 py-3 text-center text-xs font-semibold sm:flex-none sm:py-2"
                  >
                    {item.status === "cancelado" ? "Avisar Cancelamento por SMS" : "Enviar SMS"}
                  </a>
                  {item.status !== "cancelado" && item.status !== "concluido" ? (
                    <button
                      type="button"
                      onClick={() => complete.mutate(item)}
                      className="flex-1 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground sm:flex-none sm:py-2"
                    >
                      Concluir
                    </button>
                  ) : null}
                  {item.status !== "cancelado" ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm("Cancelar este horário e avisar o cliente no WhatsApp?")) return;
                        const link = buildWhatsAppLink({
                          phone: item.client_phone,
                          clientName: item.client_name,
                          serviceName: item.service_name,
                          date: item.appointment_date,
                          time: item.start_time.slice(0, 5),
                          kind: "cancel",
                          lang: langs[item.id] ?? detectLang(item.client_phone),
                        });
                        // Open synchronously (user gesture) so popup blockers allow it.
                        window.open(link, "_blank", "noopener");
                        cancel.mutate(item.id);
                      }}
                      className="glass-soft flex-1 rounded-xl px-4 py-3 text-xs font-semibold text-foreground/70 sm:flex-none sm:py-2"
                    >
                      Cancelar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setTarget(item)}
                    className="flex-1 rounded-xl bg-destructive/10 px-4 py-3 text-xs sm:flex-none sm:py-2 font-semibold text-destructive"
                  >
                    Excluir marcação
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
      <ExcluirOuRemarcarDialog
        target={target}
        onClose={() => setTarget(null)}
        onDelete={(id) => remove.mutate(id)}
      />
      <NovaMarcacaoDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultDate={anchor}
        onCreated={(date) => {
          setView("dia");
          setAnchor(date);
        }}
      />
    </div>
  );
}
