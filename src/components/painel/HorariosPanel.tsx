import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { addDaysISO, formatLongDateBR, todayISO, WEEKDAY_LABELS } from "@/lib/schedule";

export function HorariosPanel() {
  const queryClient = useQueryClient();
  const [block, setBlock] = useState({
    block_date: todayISO(),
    end_date: todayISO(),
    all_day: true,
    start_time: "14:00",
    end_time: "18:00",
    reason: "",
  });

  const { data: settings } = useQuery({
    queryKey: ["admin-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schedule_settings").select("*").order("weekday");
      if (error) throw error;
      return data;
    },
  });

  const { data: blocks } = useQuery({
    queryKey: ["admin-blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_blocks")
        .select("*")
        .gte("block_date", todayISO())
        .order("block_date");
      if (error) throw error;
      return data;
    },
  });

  const updateSetting = useMutation({
    mutationFn: async (value: {
      weekday: number;
      is_open: boolean;
      open_time: string;
      close_time: string;
      break_start: string | null;
      break_end: string | null;
    }) => {
      const { error } = await supabase
        .from("schedule_settings")
        .update({
          is_open: value.is_open,
          open_time: value.open_time,
          close_time: value.close_time,
          break_start: value.break_start || null,
          break_end: value.break_end || null,
        })
        .eq("weekday", value.weekday);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-schedule"] }),
  });

  const addBlock = useMutation({
    mutationFn: async () => {
      const end = block.end_date || block.block_date;
      if (end < block.block_date) throw new Error("A data de fim deve ser igual ou posterior à de início.");
      if (!block.all_day && block.end_time <= block.start_time)
        throw new Error("O horário de fim deve ser depois do início.");
      const rows = [];
      for (let d = block.block_date; d <= end; d = addDaysISO(d, 1)) {
        rows.push({
          block_date: d,
          start_time: block.all_day ? "00:00" : block.start_time,
          end_time: block.all_day ? "23:59" : block.end_time,
          reason: block.reason || null,
        });
        if (rows.length > 366) throw new Error("Intervalo máximo de 1 ano.");
      }
      const { error } = await supabase.from("schedule_blocks").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blocks"] });
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });

  const removeBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-blocks"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Horário de funcionamento
        </h2>
        <div className="mt-4 space-y-3">
          {(settings ?? []).map((setting) => (
            <div key={setting.weekday} className="glass-soft rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex w-32 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={setting.is_open}
                    onChange={(e) =>
                      updateSetting.mutate({ ...setting, is_open: e.target.checked })
                    }
                  />
                  {WEEKDAY_LABELS[setting.weekday]}
                </label>
                <TimeField
                  label="Abre"
                  value={setting.open_time.slice(0, 5)}
                  onChange={(v) => updateSetting.mutate({ ...setting, open_time: v })}
                />
                <TimeField
                  label="Fecha"
                  value={setting.close_time.slice(0, 5)}
                  onChange={(v) => updateSetting.mutate({ ...setting, close_time: v })}
                />
                <TimeField
                  label="Pausa início"
                  value={setting.break_start?.slice(0, 5) ?? ""}
                  onChange={(v) => updateSetting.mutate({ ...setting, break_start: v || null })}
                />
                <TimeField
                  label="Pausa fim"
                  value={setting.break_end?.slice(0, 5) ?? ""}
                  onChange={(v) => updateSetting.mutate({ ...setting, break_end: v || null })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Bloqueios de agenda</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addBlock.mutate();
          }}
          className="glass-soft mt-4 space-y-4 rounded-2xl p-5"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-foreground/70">
              Data de início
              <input
                type="date"
                required
                value={block.block_date}
                onChange={(e) => setBlock({ ...block, block_date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-foreground/70">
              Data de fim
              <input
                type="date"
                required
                min={block.block_date}
                value={block.end_date}
                onChange={(e) => setBlock({ ...block, end_date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none"
              />
            </label>
          </div>
          <div className="flex gap-2">
            {[
              { v: true, l: "Dia todo" },
              { v: false, l: "Horário específico" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => setBlock({ ...block, all_day: o.v })}
                className={`rounded-xl px-4 py-2 text-xs font-semibold ${
                  block.all_day === o.v ? "bg-primary text-primary-foreground" : "glass-soft text-foreground/70"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {!block.all_day ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-foreground/70">
                Das
                <input
                  type="time"
                  required
                  value={block.start_time}
                  onChange={(e) => setBlock({ ...block, start_time: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-foreground/70">
                Até
                <input
                  type="time"
                  required
                  value={block.end_time}
                  onChange={(e) => setBlock({ ...block, end_time: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none"
                />
              </label>
            </div>
          ) : null}
          <input
            value={block.reason}
            onChange={(e) => setBlock({ ...block, reason: e.target.value })}
            placeholder="Motivo (férias, feriado, imprevisto…)"
            className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none"
          />
          {addBlock.error ? (
            <p className="text-xs text-destructive">{(addBlock.error as Error).message}</p>
          ) : null}
          {addBlock.isSuccess ? (
            <p className="text-xs text-foreground/70">{addBlock.data} dia(s) bloqueado(s).</p>
          ) : null}
          <button
            type="submit"
            disabled={addBlock.isPending}
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"
          >
            Bloquear período
          </button>
        </form>

        <ul className="mt-4 space-y-2">
          {(blocks ?? []).map((item) => (
            <li key={item.id} className="glass-soft flex items-center justify-between rounded-2xl p-4">
              <span className="text-xs text-foreground/70">
                {formatLongDateBR(item.block_date)} · {item.start_time.slice(0, 5)}–
                {item.end_time.slice(0, 5)} · {item.reason ?? "Bloqueado"}
              </span>
              <button
                type="button"
                onClick={() => removeBlock.mutate(item.id)}
                className="text-xs font-semibold text-destructive"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[11px] text-foreground/60">
      {label}
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
      />
    </label>
  );
}
