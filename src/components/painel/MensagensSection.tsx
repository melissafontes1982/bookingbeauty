import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_VARS,
  fillTemplate,
  type MessageTemplates,
  type MsgKind,
  type MsgLang,
} from "@/lib/schedule";

const KINDS: { kind: MsgKind; label: string }[] = [
  { kind: "confirm", label: "Confirmação" },
  { kind: "cancel", label: "Cancelamento" },
  { kind: "remind", label: "Lembrete (véspera)" },
];

const VAR_HELP: Record<string, string> = {
  "{cliente}": "Nome do cliente",
  "{servico}": "Serviço",
  "{data}": "Data",
  "{horario}": "Horário",
  "{estabelecimento}": "Nome do estabelecimento",
  "{contato}": "Instruções de contato",
  "{link}": "Link para gerir a marcação",
};

type Full = Record<MsgLang, Record<MsgKind, string>>;

function merge(t: MessageTemplates | null | undefined): Full {
  const out = structuredClone(DEFAULT_TEMPLATES) as Full;
  for (const lang of ["pt", "en"] as MsgLang[])
    for (const { kind } of KINDS) {
      const v = t?.[lang]?.[kind];
      if (v && v.trim()) out[lang][kind] = v;
    }
  return out;
}

const inputCls =
  "mt-2 w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

export function MensagensSection() {
  const qc = useQueryClient();
  const [lang, setLang] = useState<MsgLang>("pt");
  const [tpls, setTpls] = useState<Full>(DEFAULT_TEMPLATES);
  const [business, setBusiness] = useState("");
  const [contact, setContact] = useState("");
  const refs = useRef<Partial<Record<MsgKind, HTMLTextAreaElement | null>>>({});

  const { data } = useQuery({
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

  useEffect(() => {
    if (!data) return;
    setTpls(merge(data.message_templates as MessageTemplates));
    setBusiness(data.company_name ?? "");
    setContactPt(data.contact_instructions ?? "");
    setContactEn(String((data.message_templates as { contact_en?: string } | null)?.contact_en ?? ""));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("general_settings")
        .update({
          company_name: business.trim() || "Studio Eleve",
          message_templates: { ...tpls, contact_en: contactEn.trim() },
          contact_instructions: contactPt.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-config"] });
      qc.invalidateQueries({ queryKey: ["general-settings"] });
    },
  });

  function insertVar(kind: MsgKind, v: string) {
    const el = refs.current[kind];
    const cur = tpls[lang][kind];
    const s = el?.selectionStart ?? cur.length;
    const e = el?.selectionEnd ?? cur.length;
    const next = cur.slice(0, s) + v + cur.slice(e);
    setTpls({ ...tpls, [lang]: { ...tpls[lang], [kind]: next } });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + v.length, s + v.length);
    });
  }

  const sample = {
    cliente: "Ana Silva",
    servico: lang === "en" ? "Facial cleansing" : "Limpeza de pele",
    data: lang === "en" ? "15 October 2026" : "15/10/2026",
    horario: "14:30",
    estabelecimento: business,
    contato: contact,
    link: "https://…/agendamento/abc",
  };

  return (
    <div className="glass-soft max-w-3xl space-y-5 rounded-2xl p-5">
      <div>
        <p className="eyebrow">Mensagens</p>
        <h3 className="mt-1 font-display text-xl font-semibold">Modelos de mensagens</h3>
        <p className="mt-1 text-xs text-foreground/60">
          Textos enviados por WhatsApp e SMS. Toque numa etiqueta para inseri-la onde está o cursor.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-foreground/70">
          Nome do estabelecimento
          <input value={business} onChange={(e) => setBusiness(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-xs font-medium text-foreground/70">
          Instruções de contato
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Dúvidas? Ligue 912 345 678."
            className={inputCls}
          />
        </label>
      </div>

      <div className="inline-flex rounded-xl border border-border p-1">
        {(["pt", "en"] as MsgLang[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold ${lang === l ? "bg-primary text-primary-foreground" : "text-foreground/70"}`}
          >
            {l === "pt" ? "Português" : "English"}
          </button>
        ))}
      </div>

      {KINDS.map(({ kind, label }) => (
        <div key={kind} className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{label}</p>
            <button
              type="button"
              onClick={() => setTpls({ ...tpls, [lang]: { ...tpls[lang], [kind]: DEFAULT_TEMPLATES[lang][kind] } })}
              className="text-xs text-foreground/60 underline"
            >
              Restaurar padrão
            </button>
          </div>
          <textarea
            ref={(el) => {
              refs.current[kind] = el;
            }}
            rows={4}
            value={tpls[lang][kind]}
            onChange={(e) => setTpls({ ...tpls, [lang]: { ...tpls[lang], [kind]: e.target.value } })}
            className={inputCls}
          />
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARS.map((v) => (
              <button
                key={v}
                type="button"
                title={VAR_HELP[v]}
                onClick={() => insertVar(kind, v)}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground/70 hover:bg-accent"
              >
                {v}
              </button>
            ))}
          </div>
          <p className="rounded-xl bg-muted/50 p-3 text-xs text-foreground/70">
            <span className="font-semibold">Pré-visualização: </span>
            {fillTemplate(tpls[lang][kind], sample)}
          </p>
        </div>
      ))}

      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {save.isPending ? "Salvando…" : "Salvar modelos"}
      </button>
      {save.isSuccess ? <p className="text-xs text-brand-deep">Modelos salvos.</p> : null}
      {save.isError ? <p className="text-xs text-destructive">Não foi possível salvar.</p> : null}
    </div>
  );
}
