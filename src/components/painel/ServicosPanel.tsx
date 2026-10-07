import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatPriceEUR } from "@/lib/schedule";

type Draft = {
  id?: string;
  name: string;
  description: string;
  duration_min: number;
  buffer_min: number;
  price: number;
  active: boolean;
};

const emptyDraft: Draft = {
  name: "",
  description: "",
  duration_min: 60,
  buffer_min: 15,
  price: 0,
  active: true,
};

export function ServicosPanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const draftKey = draft ? (draft.id ?? "new") : null;

  useEffect(() => {
    if (!draftKey || !formRef.current) return;
    formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    formRef.current.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, [draftKey]);

  const { data: services } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const payload = {
        name: value.name,
        description: value.description || null,
        duration_min: value.duration_min,
        buffer_min: value.buffer_min,
        price: value.price,
        active: value.active,
      };
      const { error } = value.id
        ? await supabase.from("services").update(payload).eq("id", value.id)
        : await supabase.from("services").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-services"] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Serviços</h2>
        <button
          type="button"
          onClick={() => setDraft({ ...emptyDraft })}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          Novo serviço
        </button>
      </div>

      {draft ? (
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(draft);
          }}
          className="glass-soft space-y-3 rounded-2xl p-5"
        >
          <input
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Nome do serviço"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none"
          />
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Descrição"
            rows={2}
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs text-foreground/60">
              Duração (min)
              <input
                type="number"
                min={15}
                step={5}
                value={draft.duration_min}
                onChange={(e) => setDraft({ ...draft, duration_min: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none"
              />
            </label>
            <label className="text-xs text-foreground/60">
              Higienização (min)
              <input
                type="number"
                min={0}
                step={5}
                value={draft.buffer_min}
                onChange={(e) => setDraft({ ...draft, buffer_min: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none"
              />
            </label>
            <label className="text-xs text-foreground/60">
              Preço (€)
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground/70">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Serviço ativo no agendamento público
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="glass-soft rounded-xl px-4 py-2.5 text-xs font-semibold text-foreground/70"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {(services ?? []).map((service) => (
          <div key={service.id} className="glass-soft rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{service.name}</p>
              <p className="font-display text-lg font-semibold">
                {formatPriceEUR(Number(service.price))}
              </p>
            </div>
            <p className="mt-1 text-xs text-foreground/60">
              {service.duration_min}min · higienização {service.buffer_min}min ·{" "}
              {service.active ? "ativo" : "inativo"}
            </p>
            {service.description ? (
              <p className="mt-1 text-xs text-foreground/50">{service.description}</p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    id: service.id,
                    name: service.name,
                    description: service.description ?? "",
                    duration_min: service.duration_min,
                    buffer_min: service.buffer_min,
                    price: Number(service.price),
                    active: service.active,
                  })
                }
                className="glass-soft rounded-xl px-4 py-2 text-xs font-semibold text-foreground/70"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => remove.mutate(service.id)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-destructive"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
