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
  hours: { weekday: number; is_open: boolean; open_time: string; close_time: string }[];
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
      supabaseAdmin.from("schedule_settings").select("weekday, is_open, open_time, close_time"),
    ]);

    return {
      settings: settings ?? null,
      openWeekdays: (schedule ?? []).filter((s) => s.is_open).map((s) => s.weekday),
      hours: schedule ?? [],
    };
  },
);

export type PublicProfessional = { id: string; name: string; bio: string | null; photo_url: string | null; serviceIds: string[] };

/** Active professionals with the services they perform (public display fields only). */
export const getPublicProfessionals = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicProfessional[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: pros }, { data: links }] = await Promise.all([
      supabaseAdmin.from("professionals").select("id, name, bio, photo_url").eq("active", true).order("name"),
      supabaseAdmin.from("professional_services").select("professional_id, service_id"),
    ]);
    return (pros ?? []).map((p) => ({
      ...p,
      serviceIds: (links ?? []).filter((l) => l.professional_id === p.id).map((l) => l.service_id),
    }));
  },
);
