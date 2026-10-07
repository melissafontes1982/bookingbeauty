import type { CSSProperties } from "react";

export type ThemeColors = {
  theme_primary: string | null;
  theme_button: string | null;
  theme_button_text: string | null;
  theme_text: string | null;
  theme_background: string | null;
};

/** Cores originais da marca (usadas em "Restaurar Padrão" e como referência nos seletores). */
export const DEFAULT_THEME: Record<keyof ThemeColors, string> = {
  theme_primary: "#2f5248",
  theme_button: "#2f5248",
  theme_button_text: "#fbfcfb",
  theme_text: "#22322d",
  theme_background: "#eef3f4",
};

export const THEME_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "theme_primary", label: "Cor Primária / Destaque" },
  { key: "theme_button", label: "Cor dos Botões" },
  { key: "theme_button_text", label: "Cor do Texto dos Botões" },
  { key: "theme_text", label: "Cor do Texto Principal" },
  { key: "theme_background", label: "Cor de Fundo da Página" },
];

export const isHex = (v: string | null | undefined): v is string =>
  !!v && /^#[0-9a-fA-F]{6}$/.test(v);

/** Converte as cores salvas em variáveis CSS que sobrescrevem os tokens do tema. */
export function themeToCssVars(t: Partial<ThemeColors> | null | undefined): CSSProperties {
  const vars: Record<string, string> = {};
  if (!t) return vars;
  if (isHex(t.theme_primary)) {
    vars["--brand-deep"] = t.theme_primary;
    vars["--brand"] = t.theme_primary;
    vars["--ring"] = t.theme_primary;
  }
  if (isHex(t.theme_button)) vars["--primary"] = t.theme_button;
  if (isHex(t.theme_button_text)) vars["--primary-foreground"] = t.theme_button_text;
  if (isHex(t.theme_text)) {
    vars["--ink"] = t.theme_text;
    vars["--foreground"] = t.theme_text;
  }
  if (isHex(t.theme_background)) vars["background"] = t.theme_background;
  return vars as CSSProperties;
}
