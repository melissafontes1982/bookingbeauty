import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { recommendLocally } from "./recommend-local";

const schema = z.object({ needs: z.string().trim().min(5).max(1000) });

export type Recommendation = {
  ok: boolean;
  error?: string;
  summary?: string;
  items?: { serviceId: string; name: string; reason: string }[];
  healthNote?: string;
};

export const recommendServices = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }): Promise<Recommendation> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: services } = await supabaseAdmin
      .from("services")
      .select("id, name, description, duration_min, name_en, description_en")
      .eq("active", true);
    if (!services?.length) return { ok: false, error: "Ainda não há serviços disponíveis." };

    // 1) Se houver uma IA configurada (AI_API_KEY), tenta primeiro com ela.
    const { aiConfigured, generateText } = await import("./ai.server");
    if (aiConfigured()) {
      const catalog = services
        .map((s) => `- id: ${s.id} | ${s.name} (${s.duration_min} min): ${s.description ?? ""}`)
        .join("\n");

      const system = `Você é assistente de um estúdio de estética e bem-estar em Portugal. Recomende de 1 a 3 serviços APENAS do catálogo abaixo que melhor atendam às necessidades do cliente. Responda em português europeu, tom acolhedor, cada motivo com no máximo 2 frases. Nunca faça diagnósticos nem prometa resultados médicos. Se o cliente mencionar dor, lesão, gravidez, doença, cirurgia, medicação ou qualquer questão de saúde, preencha healthNote orientando a consultar o profissional (e um médico se necessário) antes da sessão; caso contrário healthNote pode ser uma breve nota a recomendar falar com o profissional em caso de dúvidas.\n\nResponda SOMENTE com JSON no formato: {"summary": string, "items": [{"serviceId": string, "reason": string}], "healthNote": string}\n\nCatálogo:\n${catalog}`;

      try {
        const text = await generateText({ system, user: data.needs, maxTokens: 800 });
        const match = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match?.[0] ?? "{}") as {
          summary?: string;
          items?: { serviceId?: string; reason?: string }[];
          healthNote?: string;
        };
        const items = (parsed.items ?? [])
          .map((i) => {
            const s = services.find((x) => x.id === i.serviceId);
            return s ? { serviceId: s.id, name: s.name, reason: String(i.reason ?? "") } : null;
          })
          .filter((i): i is NonNullable<typeof i> => i !== null)
          .slice(0, 3);
        if (items.length) {
          return {
            ok: true,
            summary: parsed.summary ?? "",
            items,
            healthNote:
              parsed.healthNote ||
              "Em caso de dúvidas de saúde, fale com o profissional antes da sua sessão.",
          };
        }
      } catch (e) {
        // Limite atingido, chave inválida, falha de rede... não é problema: usa a pesquisa local.
        console.error("recommendServices (IA indisponível, a usar pesquisa local)", e);
      }
    }

    // 2) Pesquisa local: gratuita, não envia dados para fora e funciona sempre.
    return recommendLocally(data.needs, services);
  });
