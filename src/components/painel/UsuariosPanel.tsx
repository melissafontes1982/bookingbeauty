import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";


function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação.";
}

export function UsuariosPanel() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

 const { data: users, isLoading } = useQuery({
  queryKey: ["managed-users"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_managed_users");
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      email: string;
      isAdmin: boolean;
      createdAt: string;
      lastSignInAt: string | null;
      confirmed: boolean;
    }>;
  },
});

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["managed-users"] });

  const create = useMutation({
    mutationFn: async () => {
      const result = await createFn({ data: { email: email.trim(), password, isAdmin } });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      setEmail("");
      setPassword("");
      setError(null);
      setFeedback("Acesso criado com sucesso.");
      refresh();
    },
    onError: (err) => {
      setFeedback(null);
      setError(messageOf(err));
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: (vars: { userId: string; isAdmin: boolean }) => roleFn({ data: vars }),
    onSuccess: () => {
      setError(null);
      setFeedback("Permissões atualizadas.");
      refresh();
    },
    onError: (err) => {
      setFeedback(null);
      setError(messageOf(err));
    },
  });

  const changePassword = useMutation({
    mutationFn: async (vars: { userId: string; password: string }) => {
      const result = await passwordFn({ data: vars });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      setPasswordFor(null);
      setNewPassword("");
      setError(null);
      setFeedback("Senha alterada com sucesso.");
    },
    onError: (err) => {
      setFeedback(null);
      setError(messageOf(err));
    },
  });

  const remove = useMutation({
    mutationFn: (vars: { userId: string }) => removeFn({ data: vars }),
    onSuccess: () => {
      setError(null);
      setFeedback("Acesso removido.");
      refresh();
    },
    onError: (err) => {
      setFeedback(null);
      setError(messageOf(err));
    },
  });

  const inputClass =
    "w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Acessos</p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
          Pessoas com acesso ao painel
        </h2>
        <p className="mt-1 text-sm text-foreground/60">
          Crie acessos, defina quem pode administrar e altere senhas quando precisar.
        </p>
      </div>

      {feedback ? <p className="text-xs text-brand-deep">{feedback}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
        className="glass-soft grid gap-3 rounded-2xl p-5 sm:grid-cols-2"
      >
        <div>
          <label className="eyebrow">E-mail</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@exemplo.com"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className="eyebrow">Senha inicial</label>
          <input
            required
            type="text"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground/70">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            className="size-4 rounded"
          />
          Pode administrar o sistema
        </label>
        <div className="sm:text-right">
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {create.isPending ? "Criando…" : "Criar acesso"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {isLoading ? <p className="text-sm text-foreground/60">Carregando…</p> : null}
        {(users ?? []).map((user) => (
          <div key={user.id} className="glass-soft rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{user.email}</p>
                <p className="eyebrow mt-1">
                  {user.isAdmin ? "Administrador" : "Acesso comum"}
                  {user.lastSignInAt
                    ? ` · último acesso ${new Date(user.lastSignInAt).toLocaleDateString("pt-PT")}`
                    : " · nunca entrou"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAdmin.mutate({ userId: user.id, isAdmin: !user.isAdmin })}
                  className="glass rounded-full px-4 py-2 text-xs font-semibold"
                >
                  {user.isAdmin ? "Remover administrador" : "Tornar administrador"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordFor(passwordFor === user.id ? null : user.id);
                    setNewPassword("");
                  }}
                  className="glass rounded-full px-4 py-2 text-xs font-semibold"
                >
                  Alterar senha
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remover o acesso de ${user.email}?`)) {
                      remove.mutate({ userId: user.id });
                    }
                  }}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-destructive"
                >
                  Remover
                </button>
              </div>
            </div>

            {passwordFor === user.id ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  changePassword.mutate({ userId: user.id, password: newPassword });
                }}
                className="mt-4 flex flex-wrap items-center gap-2"
              >
                <input
                  required
                  type="text"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (mínimo 8 caracteres)"
                  className={`${inputClass} sm:max-w-xs`}
                />
                <button
                  type="submit"
                  disabled={changePassword.isPending}
                  className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {changePassword.isPending ? "Salvando…" : "Salvar senha"}
                </button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
