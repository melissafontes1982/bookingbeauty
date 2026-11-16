/**
 * Chamada simples a um modelo de IA, sem dependências extra.
 *
 * Variáveis de ambiente (definir no Vercel):
 *   AI_API_KEY    chave do fornecedor (obrigatória; sem ela as funções de IA ficam desligadas)
 *   AI_PROVIDER   "anthropic" (padrão) ou "openai" (também serve para APIs compatíveis com a da OpenAI)
 *   AI_MODEL      nome do modelo. Padrão para anthropic: claude-haiku-5-5. Obrigatório para openai.
 *   AI_BASE_URL   só para "openai": endereço base da API (padrão https://api.openai.com/v1)
 */
export class AiError extends Error {
  statusCode: number | undefined;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function aiConfigured(): boolean {
  if (!process.env["AI_API_KEY"]) return false;
  const provider = (process.env["AI_PROVIDER"] ?? "anthropic").toLowerCase();
  return provider === "anthropic" || Boolean(process.env["AI_MODEL"]);
}

export async function generateText(opts: { system: string; user: string; maxTokens?: number }): Promise<string> {
  const apiKey = process.env["AI_API_KEY"];
  if (!apiKey) throw new AiError("AI_API_KEY não definida.");
  const provider = (process.env["AI_PROVIDER"] ?? "anthropic").toLowerCase();
  const maxTokens = opts.maxTokens ?? 1000;

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env["AI_MODEL"] || "claude-haiku-5-5",
        max_tokens: maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      }),
    });
    if (!res.ok) throw new AiError(`Anthropic ${res.status}: ${await res.text()}`, res.status);
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  }

  const model = process.env["AI_MODEL"];
  if (!model) throw new AiError("AI_MODEL não definido.");
  const base = (process.env["AI_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok) throw new AiError(`${provider} ${res.status}: ${await res.text()}`, res.status);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}
