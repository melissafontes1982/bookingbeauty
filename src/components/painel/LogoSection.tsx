import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";

function resizeImage(file: File, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Não foi possível processar a imagem."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function LogoSection() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["logo-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("general_settings").select("logo_url").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (logo: string | null) => {
      const { error } = await supabase.from("general_settings").update({ logo_url: logo }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logo-settings"] });
      queryClient.invalidateQueries({ queryKey: ["general-settings"] });
    },
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Escolha um arquivo de imagem.");
    if (file.size > 5 * 1024 * 1024) return setError("A imagem deve ter no máximo 5 MB.");
    try {
      save.mutate(await resizeImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    }
  }

  const logo = data?.logo_url;

  return (
    <div className="glass-soft max-w-xl space-y-4 rounded-2xl p-5">
      <div>
        <p className="eyebrow">Logotipo</p>
        <p className="mt-1 text-sm text-foreground/70">Aparece no topo da página de agendamento e do painel.</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="glass grid size-20 place-items-center overflow-hidden rounded-2xl">
          {logo ? (
            <img src={logo} alt="Logotipo" className="size-full object-contain" />
          ) : (
            <span className="text-xs text-foreground/50">Sem logo</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground">
            {save.isPending ? "Enviando…" : logo ? "Trocar logotipo" : "Enviar logotipo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {logo ? (
            <button
              type="button"
              onClick={() => save.mutate(null)}
              className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground/70"
            >
              Remover
            </button>
          ) : null}
        </div>
      </div>
      {error || save.isError ? (
        <p className="text-xs text-destructive">{error ?? "Não foi possível salvar o logotipo."}</p>
      ) : null}
    </div>
  );
}
