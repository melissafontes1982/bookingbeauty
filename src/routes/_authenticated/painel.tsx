import { setMessageConfig, type MessageTemplates } from "@/lib/schedule";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AgendaPanel } from "@/components/painel/AgendaPanel";
import { ClientesPanel } from "@/components/painel/ClientesPanel";
import { ConfiguracoesPanel } from "@/components/painel/ConfiguracoesPanel";
import { HorariosPanel } from "@/components/painel/HorariosPanel";
import { ServicosPanel } from "@/components/painel/ServicosPanel";
import { UsuariosPanel } from "@/components/painel/UsuariosPanel";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Studio Eleve" },
      { name: "description", content: "Painel restrito de gestão da agenda de Studio Eleve." },
      { property: "og:title", content: "Painel — Studio Eleve" },
      { property: "og:description", content: "Gestão restrita de agenda, serviços e clientes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PainelPage,
});

type Tab = "agenda" | "servicos" | "clientes" | "horarios" | "usuarios" | "configuracoes";

const TABS: { id: Tab; label: string }[] = [
  { id: "agenda", label: "Agenda" },
  { id: "servicos", label: "Serviços" },
  { id: "clientes", label: "Clientes" },
  { id: "horarios", label: "Horários" },
  { id: "usuarios", label: "Acessos" },
  { id: "configuracoes", label: "Configurações" },
];

function PainelPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("agenda");

  const { data: settings } = useQuery({
    queryKey: ["general-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_settings")
        .select("company_name, business_segment, logo_url")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: msgCfg } = useQuery({
    queryKey: ["message-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_settings")
        .select("company_name, message_templates, contact_instructions")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
  });
  if (msgCfg) {
    setMessageConfig({
      templates: (msgCfg.message_templates ?? {}) as MessageTemplates,
      businessName: msgCfg.company_name ?? "",
      contact: msgCfg.contact_instructions ?? "",
    });
  }

  const companyName = settings?.company_name ?? "Studio Eleve";
  const segment = settings?.business_segment?.trim() || "Estética e bem-estar";

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={companyName} className="h-12 w-auto max-w-[140px] rounded-2xl object-contain" />
            ) : (
              <div className="glass grid size-11 place-items-center rounded-2xl">
                <span className="font-display text-lg font-semibold text-brand-deep">
                  {companyName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="font-display text-lg font-semibold leading-none tracking-tight">
                {companyName}
              </p>
              <p className="eyebrow mt-1">{segment} · Painel do profissional</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="glass-soft rounded-full px-4 py-2 text-sm font-medium text-foreground/70"
            >
              Ver página pública
            </Link>
            <button
              type="button"
              onClick={async () => {
                await queryClient.cancelQueries();
                queryClient.clear();
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Sair
            </button>
          </div>
        </header>

        <nav className="glass-soft mt-8 flex flex-wrap gap-1 rounded-2xl p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold ${
                tab === item.id ? "bg-primary text-primary-foreground" : "text-foreground/70"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="glass mt-6 rounded-3xl p-7">
          {tab === "agenda" ? <AgendaPanel /> : null}
          {tab === "servicos" ? <ServicosPanel /> : null}
          {tab === "clientes" ? <ClientesPanel /> : null}
          {tab === "horarios" ? <HorariosPanel /> : null}
          {tab === "usuarios" ? <UsuariosPanel /> : null}
          {tab === "configuracoes" ? <ConfiguracoesPanel /> : null}
        </div>
      </div>
    </div>
  );
}
