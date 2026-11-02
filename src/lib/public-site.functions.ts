import { createServerFn } from "@tanstack/react-start";

export type PublicSiteInfo = {
  settings: {
    company_name: string;
    business_segment: string;
    whatsapp_number: string;
    logo_url: string | null;
    theme_primary: string | null;
    theme_button: string | null;
    theme_button_text: string | null;
    theme_text: string | null;
    theme_background: string | null;
  } | null;
  openWeekdays: number[];
};

/**
 * Public booking-page info. Visitors cannot read the settings tables directly;
 * this returns only the fields the public pages need to display.
 */
export const getPublicSiteInfo = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSiteInfo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: settings }, { data: schedule }] = await Promise.all([
      supabaseAdmin
        .from("general_settings")
        .select(
          "company_name, business_segment, whatsapp_number, logo_url, theme_primary, theme_button, theme_button_text, theme_text, theme_background",
        )
        .eq("id", 1)
        .maybeSingle(),
      supabaseAdmin.from("schedule_settings").select("weekday, is_open"),
    ]);

    return {
      settings: settings ?? null,
      openWeekdays: (schedule ?? []).filter((s) => s.is_open).map((s) => s.weekday),
    };
  },
);
