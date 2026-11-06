import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const STALE_DAYS = 30;

export async function useOneSession(packageId: string, appointmentId?: string | null, note?: string) {
  const { data: pkg, error: e1 } = await supabase
    .from("client_packages")
    .select("used_sessions,total_sessions")
    .eq("id", packageId)
    .single();
  if (e1) throw e1;
  if (pkg.used_sessions >= pkg.total_sessions) throw new Error("Pacote sem sessões restantes.");
  const now = new Date().toISOString();
  const { error: e2 } = await supabase
    .from("client_packages")
    .update({ used_sessions: pkg.used_sessions + 1, last_used_at: now })
    .eq("id", packageId);
  if (e2) throw e2;
  const { error: e3 } = await supabase
    .from("package_sessions")
    .insert({ package_id: packageId, appointment_id: appointmentId ?? null, note: note ?? null });
  if (e3) throw e3;
}

export function PacotesCliente({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<{ name: string; total: string; used: string; notes: string } | null>(null);
  const [histFor, setHistFor] = useState<string | null>(null);

  const { data: pkgs } = useQuery({
    queryKey: ["client-packages", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_packages")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["package-sessions", histFor],
    enabled: Boolean(histFor),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_sessions")
        .select("*")
        .eq("package_id", histFor!)
        .order("used_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["client-packages"] });
    qc.invalidateQueries({ queryKey: ["package-sessions"] });
    qc.invalidateQueries({ queryKey: ["all-packages"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const total = Math.max(1, parseInt(form.total) || 1);
      const used = Math.min(total, Math.max(0, parseInt(form.used) || 0));
      const { error } = await supabase.from("client_packages").insert({
        client_id: clientId,
        name: form.name.trim(),
        total_sessions: total,
        used_sessions: used,
        notes: form.notes.trim() || null,
        last_used_at: used > 0 ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(null);
      refresh();
    },
    onError: (e) => window.alert((e as Error).message),
  });

  const consume = useMutation({
    mutationFn: (id: string) => useOneSession(id, null, "Abatido manualmente"),
    onSuccess: refresh,
    onError: (e) => window.alert((e as Error).message),
  });

  const adjust = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "used_sessions" | "total_sessions"; value: number }) => {
      const { error } = await supabase.from("client_packages").update(field === "used_sessions" ? { used_sessions: value } : { total_sessions: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const btn = "glass-soft rounded-xl px-3 py-2 text-xs font-semibold text-foreground/70";

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Pacotes de sessões</p>
        {!form ? (
          <button type="button" onClick={() => setForm({ name: "", total: "5", used: "0", notes: "" })} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
            + Adicionar pacote
          </button>
        ) : null}
      </div>

      {form ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-2 rounded-xl border border-border p-3"
        >
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do pacote (ex.: 5 massagens relaxantes)" className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-foreground/60">
              Total de sessões
              <input type="number" min={1} required value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none" />
            </label>
            <label className="text-xs text-foreground/60">
              Já realizadas
              <input type="number" min={0} value={form.used} onChange={(e) => setForm({ ...form, used: e.target.value })} className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none" />
            </label>
          </div>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observações (opcional)" className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none" />
          <div className="flex gap-2">
            <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Salvar pacote</button>
            <button type="button" onClick={() => setForm(null)} className={btn}>Cancelar</button>
          </div>
        </form>
      ) : null}

      {(pkgs ?? []).length === 0 && !form ? <p className="text-xs text-foreground/50">Nenhum pacote.</p> : null}

      {(pkgs ?? []).map((p) => {
        const left = p.total_sessions - p.used_sessions;
        const done = left <= 0;
        const stale =
          !done && p.last_used_at && Date.now() - new Date(p.last_used_at).getTime() > STALE_DAYS * 86400000;
        return (
          <div key={p.id} className={`rounded-xl border p-3 ${done ? "border-border opacity-60" : "border-primary/40"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{p.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${done ? "bg-muted text-foreground/60" : "bg-primary/15 text-primary"}`}>
                {done ? "Concluído" : `${left} de ${p.total_sessions} restantes`}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, (p.used_sessions / p.total_sessions) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-foreground/50">
              {p.used_sessions} realizadas
              {p.last_used_at ? ` · última em ${new Date(p.last_used_at).toLocaleDateString("pt-PT")}` : ""}
              {p.notes ? ` · ${p.notes}` : ""}
            </p>
            {stale ? <p className="mt-1 text-xs font-semibold text-destructive">⏰ Sem sessões há mais de {STALE_DAYS} dias</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {!done ? (
                <button type="button" onClick={() => consume.mutate(p.id)} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                  − Abater 1 sessão
                </button>
              ) : null}
              <button type="button" disabled={p.used_sessions <= 0} onClick={() => adjust.mutate({ id: p.id, field: "used_sessions", value: p.used_sessions - 1 })} className={btn}>
                Desfazer 1
              </button>
              <button type="button" onClick={() => adjust.mutate({ id: p.id, field: "total_sessions", value: p.total_sessions + 1 })} className={btn}>
                + 1 sessão ao total
              </button>
              <button type="button" onClick={() => setHistFor(histFor === p.id ? null : p.id)} className={btn}>
                {histFor === p.id ? "Ocultar histórico" : "Histórico"}
              </button>
              <button type="button" onClick={() => window.confirm("Apagar este pacote?") && remove.mutate(p.id)} className="rounded-xl px-3 py-2 text-xs font-semibold text-destructive">
                Apagar
              </button>
            </div>
            {histFor === p.id ? (
              <ul className="mt-2 space-y-1 text-xs text-foreground/60">
                {(sessions ?? []).length === 0 ? <li>Sem registos.</li> : null}
                {(sessions ?? []).map((s) => (
                  <li key={s.id}>
                    {new Date(s.used_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
                    {s.note ? ` · ${s.note}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
