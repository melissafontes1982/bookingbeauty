import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

// NOVA VERSÃO:
const OWNER_EMAILS = [
  "humbertobcabral@gmail.com",
  "melissafontes1982@gmail.com",
  "hbcabral@gmail.com"
];


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    const user = data.user;

    if (error || !user) throw redirect({ to: "/auth" });

    if (OWNER_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
      await supabase.rpc("claim_authorized_admin");
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    return { user };
  },
  component: () => <Outlet />,
});
