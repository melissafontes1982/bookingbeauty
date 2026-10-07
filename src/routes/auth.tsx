import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

const AUTHORIZED_EMAIL = "humbertobcabral@gmail.com";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso restrito — Studio Eleve" },
      { name: "description", content: "Acesso exclusivo ao painel de Studio Eleve." },
      { property: "og:title", content: "Acesso restrito — Studio Eleve" },
      { property: "og:description", content: "Área administrativa exclusiva da pessoa autorizada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
      { name: "theme-color", content: "#2f5248" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Painel" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      if (data.user.email?.toLowerCase() === AUTHORIZED_EMAIL) {
        await supabase.rpc("claim_authorized_admin");
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: data.user.id,
        _role: "admin",
      });
      if (isAdmin) navigate({ to: "/painel" });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === "signup" && email.trim().toLowerCase() !== AUTHORIZED_EMAIL) {
      setError("Novos acessos são criados pela pessoa administradora, dentro do painel.");
      setLoading(false);
      return;
    }

    if (mode === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        setError("E-mail ou senha inválidos.");
      } else {
        if (data.user.email?.toLowerCase() === AUTHORIZED_EMAIL) {
          await supabase.rpc("claim_authorized_admin");
        }
        const { data: isAdmin } = await supabase.rpc("has_role", {
          _user_id: data.user.id,
          _role: "admin",
        });
        if (isAdmin) {
          navigate({ to: "/painel" });
        } else {
          await supabase.auth.signOut();
          setError("Este acesso ainda não tem permissão de administrador.");
        }
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) setError(error.message);
      else if (data.session) navigate({ to: "/painel" });
      else setMessage("Conta criada. Confirme o e-mail para entrar.");
    }
    setLoading(false);
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center px-5 py-8">
      <div className="glass w-full max-w-md rounded-3xl p-6 sm:p-7">
        <img src="/icon-192.png" alt="" width={64} height={64} className="mb-4 size-16 rounded-2xl" />
        <p className="eyebrow">Acesso exclusivo</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          {mode === "signin" ? "Entrar no painel" : "Criar seu primeiro acesso"}
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            required
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="w-full rounded-xl border border-border bg-input px-4 py-3.5 text-base outline-none sm:text-sm placeholder:text-foreground/40 focus:ring-2 focus:ring-ring"
          />
          <input
            required
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-xl border border-border bg-input px-4 py-3.5 text-base outline-none sm:text-sm placeholder:text-foreground/40 focus:ring-2 focus:ring-ring"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {message ? <p className="text-xs text-brand-deep">{message}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-xs text-foreground/60 underline"
        >
          {mode === "signin" ? "Criar meu primeiro acesso" : "Já tenho minha senha"}
        </button>

        <details className="glass-soft mt-6 rounded-2xl p-4 text-xs text-foreground/70">
          <summary className="cursor-pointer font-semibold text-foreground">
            Instalar o painel no telemóvel
          </summary>
          <p className="mt-2">
            <strong>iPhone (Safari):</strong> toque em Partilhar e depois em “Adicionar ao ecrã principal”.
          </p>
          <p className="mt-1">
            <strong>Android (Chrome):</strong> toque no menu ⋮ e depois em “Instalar app” ou “Adicionar ao ecrã principal”.
          </p>
          <p className="mt-1">O ícone abre o painel em tela cheia, sem barra do navegador, e mantém você conectado.</p>
        </details>
      </div>
    </div>
  );
}
