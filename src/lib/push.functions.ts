import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { notifyProfessionals } = await import("./push.server");
    await notifyProfessionals("🔔 Teste", "As notificações estão a funcionar neste telemóvel.");
    return { ok: true };
  });
