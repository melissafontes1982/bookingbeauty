import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default(""),
});

export type TranslateResult = { ok: boolean; error?: string; name_en?: string; description_en?: string };

export const translateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }): Promise<TranslateResult> => {
    const { aiConfigured, generateText } = await import("./ai.server");
    if (!aiConfigured()) return { ok: false, error: "Tradução indisponível no momento." };
    const system =
      'You translate service names and descriptions of a beauty, aesthetics and wellness studio from Portuguese into natural, professional English as used by spas and salons. Keep it concise and do not add information. Reply ONLY with JSON: {"name_en": string, "description_en": string}. If the description is empty, return an empty string for description_en.';
    try {
      const text = await generateText({
        system,
        user: `Name: ${data.name}\nDescription: ${data.description}`,
        maxTokens: 600,
      });
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as { name_en?: string; description_en?: string };
      if (!parsed.name_en) return { ok: false, error: "Não foi possível traduzir agora." };
      return { ok: true, name_en: parsed.name_en.trim(), description_en: (parsed.description_en ?? "").trim() };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 429) return { ok: false, error: "Muitos pedidos agora. Tente de novo em instantes." };
      if (status === 402) return { ok: false, error: "Créditos de IA esgotados." };
      console.error("translateService", e);
      return { ok: false, error: "Não foi possível traduzir agora." };
    }
  });
