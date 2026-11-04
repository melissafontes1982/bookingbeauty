import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AparenciaSection } from "./AparenciaSection";
import { BackupSection } from "./BackupSection";
import { LogoSection } from "./LogoSection";
import { MensagensSection } from "./MensagensSection";
import { NotificacoesSection } from "./NotificacoesSection";

export function ConfiguracoesPanel() {
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [segment, setSegment] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["general-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_settings")
        .select("company_name, business_segment, whatsapp_number")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name);
      setSegment(settings.business_segment ?? "");
      setWhatsapp(settings.whatsapp_number ?? "");
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async (values: { companyName: string; segment: string; whatsapp: string }) => {
      const { error } = await supabase
        .from("general_settings")
        .update({
          company_name: values.companyName.trim(),
          business_segment: values.segment.trim(),
          whatsapp_number: values.whatsapp.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["general-settings"] }),
  });


  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Configurações gerais</p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">Identidade do espaço</h2>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({ companyName, segment, whatsapp });
        }}
        className="glass-soft max-w-xl space-y-4 rounded-2xl p-5"
      >
        <label className="block text-xs font-medium text-foreground/70">
          Nome da Empresa
          <input
            required
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block text-xs font-medium text-foreground/70">
          Serviços que você oferece (ex.: Estética Facial e Corporal, Massoterapia, Design de Sobrancelhas)
          <input
            value={segment}
            onChange={(event) => setSegment(event.target.value)}
            placeholder="Estética e bem-estar"
            className="mt-2 w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block text-xs font-medium text-foreground/70">
          WhatsApp de atendimento (com código do país, ex.: 351912345678)
          <input
            type="tel"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
            placeholder="351912345678"
            className="mt-2 w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          type="submit"
          disabled={save.isPending || !companyName.trim()}
          className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? "Salvando…" : "Salvar configurações"}
        </button>
        {save.isSuccess ? <p className="text-xs text-brand-deep">Configurações salvas.</p> : null}
        {save.isError ? <p className="text-xs text-destructive">Não foi possível salvar.</p> : null}
      </form>
      <NotificacoesSection />
      <MensagensSection />
      <LogoSection />
      <AparenciaSection />
      <BackupSection />
    </div>
  );
}