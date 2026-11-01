import type { MsgLang } from "@/lib/schedule";

export function LangToggle({ value, onChange }: { value: MsgLang; onChange: (l: MsgLang) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-border text-xs font-semibold" role="group" aria-label="Idioma da mensagem">
      {(["pt", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={value === l}
          className={`px-3 py-2 ${value === l ? "bg-primary text-primary-foreground" : "text-foreground/60"}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
