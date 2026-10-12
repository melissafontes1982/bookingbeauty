import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

type FilterKey = "all" | "email" | "birthday" | "notes";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "email", label: "Com e-mail" },
  { key: "birthday", label: "Com aniversário" },
  { key: "notes", label: "Com anotações" },
];
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

import { supabase } from "@/integrations/supabase/client";
import { formatDateBR, formatLongDateBR } from "@/lib/schedule";

type Draft = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  birth_date: string;
  nif: string;
  notes: string;
};

const emptyDraft: Draft = { name: "", phone: "", email: "", birth_date: "", nif: "", notes: "" };

export function ClientesPanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const draftKey = draft ? (draft.id ?? "new") : null;

  useEffect(() => {
    if (!draftKey || !formRef.current) return;
    formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    formRef.current.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, [draftKey]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const { data: clients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const digits = search.replace(/\D/g, "");
    return (clients ?? []).filter((c) => {
      if (filter === "email" && !c.email) return false;
      if (filter === "birthday" && !c.birth_date) return false;
      if (filter === "notes" && !c.notes) return false;
      if (!term) return true;
      if (normalize(c.name).includes(term)) return true;
      if (c.email && normalize(c.email).includes(term)) return true;
      if (digits && c.phone.replace(/\D/g, "").includes(digits)) return true;
      return false;
    });
  }, [clients, search, filter]);

  const { data: history } = useQuery({
    queryKey: ["client-history", openId],
    enabled: Boolean(openId),
    queryFn: async () => {
      if (!openId) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", openId)
        .order("appointment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const payload = {
        name: value.name,
        phone: value.phone.replace(/\D/g, ""),
        email: value.email || null,
        birth_date: value.birth_date || null,
        nif: value.nif || null,
        notes: value.notes || null,
      };
      const { error } = value.id
        ? await supabase.from("clients").update(payload).eq("id", value.id)
        : await supabase.from("clients").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-clients"] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Clientes</h2>
        <button
          type="button"
          onClick={() => setDraft({ ...emptyDraft })}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          Novo cliente
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
              placeholder="Nome"
              className="rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none"
            />
            <label className="text-xs text-foreground/60">
              Data de Aniversário
              <input
                type="date"
                value={draft.birth_date}
                onChange={(e) => setDraft({ ...draft, birth_date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none"
              />
            </label>
            <input
              value={draft.nif}
              onChange={(e) => setDraft({ ...draft, nif: e.target.value })}
              placeholder="NIF"
              className="rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none"
            />
            <input
              required
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="WhatsApp"
              className="rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none"
            />
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="E-mail"
              className="rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none"
            />
          </div>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Observações / ficha de anamnese"
            rows={3}
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none"
          />
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

      <div className="glass-soft space-y-3 rounded-2xl p-4">
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 pr-10 text-sm outline-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground/50"
            >
              ✕
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={
                filter === f.key
                  ? "rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  : "glass-soft rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground/70"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground/50">
          Exibindo {filtered.length} de {(clients ?? []).length} clientes
        </p>
      </div>

      <div className="space-y-3">
        {clients && filtered.length === 0 ? (
          <div className="glass-soft rounded-2xl p-5 text-center text-sm text-foreground/60">
            Nenhum cliente encontrado.{" "}
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
              className="font-semibold text-primary underline"
            >
              Limpar filtros
            </button>
          </div>
        ) : null}
        {filtered.map((client) => (
          <div key={client.id} className="glass-soft rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{client.name}</p>
              <p className="text-xs text-foreground/60">{client.phone}</p>
            </div>
            {client.email ? (
              <p className="mt-1 text-xs text-foreground/50">{client.email}</p>
            ) : null}
            {client.birth_date ? (
              <p className="mt-1 text-xs text-foreground/50">
                Aniversário: {formatDateBR(client.birth_date)}
              </p>
            ) : null}
            {client.notes ? (
              <p className="mt-1 text-xs text-foreground/50">{client.notes}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOpenId(openId === client.id ? null : client.id)}
                className="glass-soft rounded-xl px-4 py-2 text-xs font-semibold text-foreground/70"
              >
                {openId === client.id ? "Ocultar histórico" : "Histórico"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    id: client.id,
                    name: client.name,
                    phone: client.phone,
                    email: client.email ?? "",
                    birth_date: client.birth_date ?? "",
                    notes: client.notes ?? "",
                  })
                }
                className="glass-soft rounded-xl px-4 py-2 text-xs font-semibold text-foreground/70"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => remove.mutate(client.id)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-destructive"
              >
                Excluir
              </button>
            </div>

            {openId === client.id ? (
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-foreground/60">
                {(history ?? []).length === 0 ? (
                  <li>Nenhum atendimento registrado.</li>
                ) : (
                  (history ?? []).map((item) => (
                    <li key={item.id}>
                      {formatLongDateBR(item.appointment_date)} · {item.start_time.slice(0, 5)} ·{" "}
                      {item.service_name} · {item.status}
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
