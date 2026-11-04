import { useSyncExternalStore } from "react";

export type Lang = "pt" | "en";
const KEY = "site-lang";
const listeners = new Set<() => void>();

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "pt";
  } catch {
    return "pt";
  }
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang === "en" ? "en" : "pt";
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "pt",
  );
}

const WD_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WDL_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WDL_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayShort(lang: Lang, wd: number) {
  return (lang === "en" ? WD_EN : WD_PT)[wd] ?? "";
}

export function longDate(lang: Lang, iso: string) {
  const [y = 2026, m = 1, d = 1] = iso.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return lang === "en" ? `${WDL_EN[wd]}, ${dd}/${mm}` : `${WDL_PT[wd]}, ${dd}/${mm}`;
}

export function LangSwitch() {
  const lang = useLang();
  const btn = (l: Lang, flag: string, label: string) => (
    <button
      type="button"
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      aria-label={l === "en" ? "English" : "Português"}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all ${
        lang === l ? "bg-primary text-primary-foreground shadow" : "text-foreground/60"
      }`}
    >
      <span className="text-base leading-none">{flag}</span>
      {label}
    </button>
  );
  return (
    <div className="glass-soft flex items-center gap-0.5 rounded-full p-1">
      {btn("pt", "🇵🇹", "PT")}
      {btn("en", "🇬🇧", "EN")}
    </div>
  );
}
