import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import type { Lang } from "@/lib/i18n";
import { recommendServices, type Recommendation } from "@/lib/recommend.functions";

export function ServiceAdvisor({ onPick, lang = "pt" }: { onPick: (serviceId: string) => void; lang?: Lang }) {
  const L = (pt: string, en: string) => (lang === "en" ? en : pt);
  const run = useServerFn(recommendServices);
  const [open, setOpen] = useState(false);
  const [needs, setNeeds] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Recommendation | null>(null);

  async function submit() {
    if (needs.trim().length < 5) return;
    setLoading(true);
    setResult(null);
    try {
      setResult(await run({ data: { needs: lang === "en" ? `${needs}\n\n(Please reply in English.)` : needs } }));
    } catch {
      setResult({ ok: false, error: L("Não foi possível gerar a recomendação agora.", "Could not generate a recommendation right now.") });
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-soft mt-4 w-full rounded-2xl px-4 py-3 text-left text-sm"
      >
        <span className="font-semibold">{L("Não sabe qual escolher?", "Not sure which to choose?")}</span>{" "}
        <span className="text-foreground/70">{L("Conte o que procura e sugerimos o serviço ideal.", "Tell us what you need and we will suggest the ideal service.")}</span>
      </button>
    );
  }

  return (
    <div className="glass-soft mt-4 rounded-2xl p-4">
      <p className="text-sm font-semibold">{L("Descreva o que procura", "Describe what you are looking for")}</p>
      <textarea
        value={needs}
        onChange={(e) => setNeeds(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder={L("Ex.: Sinto muita tensão nos ombros e quero relaxar depois do trabalho.", "E.g. I feel a lot of tension in my shoulders and want to relax after work.")}
        className="mt-2 w-full rounded-xl border border-border bg-background/70 p-3 text-base sm:text-sm"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={loading || needs.trim().length < 5}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? L("A pensar…", "Thinking…") : L("Sugerir serviços", "Suggest services")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm">
          {L("Fechar", "Close")}
        </button>
      </div>

      {result && !result.ok && <p className="mt-3 text-sm text-destructive">{result.error}</p>}
      {result?.ok && (
        <div className="mt-4 space-y-3">
          {result.summary && <p className="text-sm text-foreground/80">{result.summary}</p>}
          {result.items?.map((item) => (
            <div key={item.serviceId} className="rounded-xl bg-background/60 p-3">
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="mt-1 text-sm text-foreground/75">{item.reason}</p>
              <button
                type="button"
                onClick={() => onPick(item.serviceId)}
                className="mt-2 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                {L("Escolher este serviço", "Choose this service")}
              </button>
            </div>
          ))}
          <p className="rounded-xl border border-border p-3 text-xs text-foreground/75">
            ⚕️ {result.healthNote} {L("Esta sugestão é apenas orientativa e não substitui avaliação profissional.", "This suggestion is for guidance only and does not replace a professional assessment.")}
          </p>
        </div>
      )}
    </div>
  );
}
