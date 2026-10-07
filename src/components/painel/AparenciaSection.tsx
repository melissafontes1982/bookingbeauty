import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_THEME, isHex, THEME_FIELDS, themeToCssVars, type ThemeColors } from "@/lib/theme";

type Draft = Record<keyof ThemeColors, string>;

export function AparenciaSection() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(DEFAULT_THEME);

  const { data } = useQuery({
    queryKey: ["theme-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_settings")
        .select("theme_primary, theme_button, theme_button_text, theme_text, theme_background")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!data) return;
    const next = { ...DEFAULT_THEME };
    for (const { key } of THEME_FIELDS) {
      const v = data[key];
      if (isHex(v)) next[key] = v;
    }
    setDraft(next);
  }, [data]);

  const save = useMutation({
    mutationFn: async (values: Partial<ThemeColors>) => {
      const { error } = await supabase
        .from("general_settings")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["theme-settings"] });
      queryClient.invalidateQueries({ queryKey: ["general-settings"] });
    },
  });

  const allValid = THEME_FIELDS.every(({ key }) => isHex(draft[key]));

  return (
    <div className="glass-soft max-w-xl space-y-4 rounded-2xl p-5">
      <div>
        <p className="eyebrow">Aparência e Paleta de Cores</p>
        <p className="mt-1 text-xs text-foreground/60">
          Personalize as cores da página de agendamento dos clientes.
        </p>
      </div>

      {THEME_FIELDS.map(({ key, label }) => (
        <label key={key} className="flex items-center justify-between gap-3 text-xs font-medium text-foreground/70">
          <span>{label}</span>
          <span className="flex items-center gap-2">
            <input
              type="color"
              value={isHex(draft[key]) ? draft[key] : "#000000"}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              className="size-10 cursor-pointer rounded-lg border border-border bg-input p-1"
            />
            <input
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value.trim() })}
              maxLength={7}
              className={`w-28 rounded-xl border bg-input px-3 py-2 font-mono text-sm uppercase outline-none focus:ring-2 focus:ring-ring ${
                isHex(draft[key]) ? "border-border" : "border-destructive"
              }`}
            />
          </span>
        </label>
      ))}

      {/* Pré-visualização usando as mesmas variáveis CSS da página pública */}
      <div
        style={{ ...themeToCssVars(draft) }}
        className="rounded-xl border border-border p-4"
      >
        <p className="font-display text-lg font-semibold text-brand-deep">Pré-visualização</p>
        <p className="text-sm text-foreground">Texto principal da página.</p>
        <span className="mt-2 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          Confirmar agendamento
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!allValid || save.isPending}
          onClick={() => save.mutate(draft)}
          className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? "Salvando…" : "Salvar Tema"}
        </button>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            setDraft(DEFAULT_THEME);
            save.mutate({
              theme_primary: null,
              theme_button: null,
              theme_button_text: null,
              theme_text: null,
              theme_background: null,
            });
          }}
          className="glass-soft rounded-xl px-5 py-2.5 text-xs font-semibold text-foreground/70"
        >
          Restaurar Padrão
        </button>
      </div>
      {save.isSuccess ? <p className="text-xs text-brand-deep">Tema salvo.</p> : null}
      {save.isError ? <p className="text-xs text-destructive">Não foi possível salvar o tema.</p> : null}
    </div>
  );
}
