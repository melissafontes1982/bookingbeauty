import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatPriceEUR } from "@/lib/schedule";

type Draft = {
  id?: string;
  name: string;
  phone: string;
  bio: string;
  active: boolean;
  serviceIds: string[];
};

const emptyDraft: Draft = { name: "", phone: "", bio: "", active: true, serviceIds: [] };

export function ProfissionaisPanel() {
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

  const { data: pros } = useQuery({
    queryKey: ["admin-professionals"],
    queryFn: async () => {
      const [{ data: list, error }, { data: links, error: e2 }] = await Promise.all([
        supabase.from("professionals").select("*").order("name"),
        supabase.from("professional_services").select("*"),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      return (list ?? []).map((p) => ({
        ...p,
        serviceIds: (links ?? []).filter((l) => l.professional_id === p.id).map((l) => l.service_id),
      }));
    },
  });

  const save = useMutation({
    mutationFn: async (v: Draft) => {
      const payload = {
        name: v.name.trim(),
        phone: v.phone.replace(/\D/g, ""),
        bio: v.bio.trim() || null,
        active: v.active,
      };
      let id = v.id;
      if (id) {
        const { error } = await supabase.from("professionals").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("professionals").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      const { error: delErr } = await supabase.from("professional_services").delete().eq("professional_id", id);
      if (delErr) throw delErr;
      if (v.serviceIds.length) {
        const { error: insErr } = await supabase
          .from("professional_services")
          .insert(v.serviceIds.map((service_id) => ({ professional_id: id!, service_id })));
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-professionals"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("professionals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-professionals"] }),
  });

  const serviceName = (id: string) => services?.find((s) => s.id === id)?.name ?? "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Equipa</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Profissionais</h2>
          <p className="mt-1 text-xs text-foreground/60">
            Cada profissional tem os seus serviços. O cliente escolhe com quem quer marcar e os horários são independentes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...emptyDraft })}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          Novo profissional
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Nome do profissional"
              className="w-full rounded-xl border border-border bg-input px-4 py-3 text-base outline-none sm:text-sm"
            />
            <input
              value={draft.phone}
              inputMode="tel"
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="WhatsApp (opcional, ex.: 351912345678)"
              className="w-full rounded-xl border border-border bg-input px-4 py-3 text-base outline-none sm:text-sm"
            />
          </div>
          <input
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
            placeholder="Apresentação curta (opcional)"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-base outline-none sm:text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-foreground/70">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Ativo (aparece no agendamento)
          </label>
          <div>
            <p className="text-sm font-semibold">Serviços que realiza</p>
            <div className="mt-2 space-y-2">
              {(services ?? []).map((s) => {
                const checked = draft.serviceIds.includes(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-3 rounded-xl bg-background/60 px-4 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          serviceIds: e.target.checked
                            ? [...draft.serviceIds, s.id]
                            : draft.serviceIds.filter((x) => x !== s.id),
                        })
                      }
                    />
                    <span>{s.name}</span>
                    <span className="text-xs text-foreground/50">
                      ({s.duration_min}min · {formatPriceEUR(Number(s.price))})
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          {save.error ? <p className="text-xs text-destructive">Não foi possível salvar.</p> : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
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
        {(pros ?? []).length === 0 ? (
          <p className="text-sm text-foreground/60">
            Ainda não há profissionais. Sem profissionais, o agendamento funciona como antes.
          </p>
        ) : null}
        {(pros ?? []).map((p) => (
          <div key={p.id} className="glass-soft rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-foreground/60">{p.active ? "ativo" : "inativo"}</p>
            </div>
            {p.bio ? <p className="mt-1 text-xs text-foreground/50">{p.bio}</p> : null}
            <p className="mt-1 text-xs text-foreground/60">
              {p.serviceIds.length ? p.serviceIds.map(serviceName).filter(Boolean).join(" · ") : "Nenhum serviço associado"}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    id: p.id,
                    name: p.name,
                    phone: p.phone,
                    bio: p.bio ?? "",
                    active: p.active,
                    serviceIds: p.serviceIds,
                  })
                }
                className="glass-soft rounded-xl px-4 py-2 text-xs font-semibold text-foreground/70"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Excluir ${p.name}?`)) remove.mutate(p.id);
                }}
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
