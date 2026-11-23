import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { buildWhatsAppLink, detectLang, formatLongDateBR, todayISO } from "@/lib/schedule";

export type RemarcarTarget = {
  id: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  appointment_date: string;
  start_time: string;
  manage_token: string;
  status: string;
};

const inputClass =
  "w-full rounded-xl border border-border bg-input px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm";

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function ExcluirOuRemarcarDialog({
  target,
  onClose,
  onDelete,
}: {
  target: RemarcarTarget | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        {target ? <Inner key={target.id} target={target} onClose={onClose} onDelete={onDelete} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Inner({
  target,
  onClose,
  onDelete,
}: {
  target: RemarcarTarget;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"choose" | "reschedule" | "done">("choose");
  const [date, setDate] = useState(target.appointment_date < todayISO() ? todayISO() : target.appointment_date);
  const [time, setTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<{ date: string; time: string } | null>(null);

  const currentTime = target.start_time.slice(0, 5);
  const canReschedule = target.status !== "cancelado" && target.status !== "concluido";

  const { data: slots, isFetching } = useQuery({
    queryKey: ["slots-remarcar", target.id, date],
    enabled: step === "reschedule" && Boolean(date),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("slots_remarcar", { _id: target.id, _date: date });
      if (error) throw new Error(error.message);
      return (data ?? []) as string[];
    },
  });

  const move = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reagendar_marcacao", {
        _id: target.id,
        _date: date,
        _time: time as string,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["slots-remarcar"] });
      setMoved({ date, time: time as string });
      setStep("done");
    },
    onError: (e) => setError((e as Error).message),
  });

  const summary = `${target.client_name} · ${target.service_name} · ${ddmm(target.appointment_date)} às ${currentTime}`;

  if (step === "done" && moved) {
    const link = buildWhatsAppLink({
      phone: target.client_phone,
      clientName: target.client_name,
      serviceName: target.service_name,
      date: moved.date,
      time: moved.time,
      kind: "confirm",
      lang: detectLang(target.client_phone),
      manageUrl: `${window.location.origin}/agendamento/${target.manage_token}`,
    });
    return (
      <>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Marcação remarcada</DialogTitle>
          <DialogDescription>
            {target.client_name} passou para {formatLongDateBR(moved.date)} às {moved.time}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white"
          >
            Avisar o cliente no WhatsApp
          </a>
          <button onClick={onClose} className="min-h-12 w-full rounded-xl border border-border px-4 text-sm font-semibold">
            Fechar
          </button>
        </div>
      </>
    );
  }

  if (step === "reschedule") {
    const noSlots = !isFetching && (slots ?? []).length === 0;
    return (
      <>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Remarcar</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block">
            <span className="eyebrow">Nova data</span>
            <input
              type="date"
              min={todayISO()}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setTime(null);
                setError(null);
              }}
              className={`${inputClass} mt-1.5`}
            />
            {date ? <span className="mt-1 block text-xs text-foreground/60">{formatLongDateBR(date)}</span> : null}
          </label>

          <div>
            <span className="eyebrow">Novo horário</span>
            <div className="mt-1.5">
              {isFetching ? (
                <p className="text-xs text-foreground/60">A procurar horários livres…</p>
              ) : noSlots ? (
                <p className="text-xs text-foreground/70">Não há horários livres neste dia. Experimente outra data.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {(slots ?? []).map((t) => {
                    const isCurrent = date === target.appointment_date && t === currentTime;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={isCurrent}
                        aria-pressed={t === time}
                        onClick={() => {
                          setTime(t);
                          setError(null);
                        }}
                        className={`min-h-11 rounded-xl text-sm font-semibold disabled:opacity-40 ${
                          t === time ? "bg-primary text-primary-foreground" : "glass-soft text-foreground/80"
                        }`}
                      >
                        {t}
                        {isCurrent ? <span className="block text-[10px] font-normal">atual</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="min-h-12 rounded-xl border border-border px-4 text-sm font-semibold"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={!time || move.isPending}
              onClick={() => {
                setError(null);
                move.mutate();
              }}
              className="min-h-12 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {move.isPending ? "A remarcar…" : "Confirmar remarcação"}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-xl">Excluir ou remarcar?</DialogTitle>
        <DialogDescription>{summary}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <button
          type="button"
          disabled={!canReschedule}
          onClick={() => setStep("reschedule")}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-primary px-4 text-left text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <CalendarClock className="size-5 shrink-0" aria-hidden="true" />
          <span>
            Remarcar
            <span className="block text-xs font-normal opacity-80">
              {canReschedule
                ? "Mudar o dia ou a hora e manter os dados do cliente"
                : "Só é possível remarcar marcações ativas"}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            onDelete(target.id);
            onClose();
          }}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-destructive/10 px-4 text-left text-sm font-semibold text-destructive"
        >
          <Trash2 className="size-5 shrink-0" aria-hidden="true" />
          <span>
            Excluir marcação
            <span className="block text-xs font-normal opacity-80">Apaga do calendário. Não pode ser desfeito.</span>
          </span>
        </button>
        <button type="button" onClick={onClose} className="min-h-12 w-full rounded-xl border border-border px-4 text-sm font-semibold">
          Voltar
        </button>
      </div>
    </>
  );
}
