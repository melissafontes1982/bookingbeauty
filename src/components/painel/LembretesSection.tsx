import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { LangToggle } from "./LangToggle";
import { addDaysISO, detectLang, type MsgLang, buildSmsLink, buildWhatsAppLink, formatLongDateBR, todayISO } from "@/lib/schedule";

const STORAGE_KEY = "lembretes-enviados";

export function LembretesSection() {
  const tomorrow = addDaysISO(todayISO(), 1);
  const [langs, setLangs] = useState<Record<string, MsgLang>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setSent(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
    } catch {
      setSent({});
    }
  }, []);

  const mark = (id: string) => {
    const next = { ...sent, [id]: true };
    setSent(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const { data } = useQuery({
    queryKey: ["appointments", "reminders", tomorrow],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("appointment_date", tomorrow)
        .neq("status", "cancelado")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const items = data ?? [];
  const pending = items.filter((a) => !sent[a.id]).length;

  return (
    <div className="glass rounded-3xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">Lembretes de amanhã</p>
          <p className="mt-1 text-sm text-foreground/70">
            {formatLongDateBR(tomorrow)} · {items.length === 0 ? "nenhum atendimento" : `${pending} de ${items.length} por enviar`}
          </p>
        </div>
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((a) => {
            const params = {
              phone: a.client_phone,
              clientName: a.client_name,
              serviceName: a.service_name,
              date: a.appointment_date,
              time: a.start_time.slice(0, 5),
              kind: "remind" as const,
              lang: langs[a.id] ?? detectLang(a.client_phone),
              manageUrl: `${window.location.origin}/agendamento/${a.manage_token}`,
            };
            return (
              <li key={a.id} className="glass-soft flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3">
                <div>
                  <p className="text-sm font-semibold">
                    {a.start_time.slice(0, 5)} · {a.client_name}
                    {sent[a.id] ? <span className="ml-2 text-xs font-medium text-brand-deep">✓ enviado</span> : null}
                  </p>
                  <p className="text-xs text-foreground/60">{a.service_name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <LangToggle value={params.lang} onChange={(l) => setLangs({ ...langs, [a.id]: l })} />
                  <a
                    href={buildWhatsAppLink(params)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => mark(a.id)}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Lembrete no WhatsApp
                  </a>
                  <a
                    href={buildSmsLink(params)}
                    onClick={() => mark(a.id)}
                    className="glass-soft rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    Lembrete por SMS
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
