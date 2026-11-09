GRANT SELECT (id, company_name, business_segment, whatsapp_number, logo_url, theme_primary, theme_button, theme_button_text, theme_text, theme_background) ON public.general_settings TO anon;
CREATE POLICY general_settings_public_branding_read ON public.general_settings FOR SELECT TO anon USING (id = 1);
GRANT SELECT (weekday, is_open, open_time, close_time) ON public.schedule_settings TO anon;
CREATE POLICY schedule_public_hours_read ON public.schedule_settings FOR SELECT TO anon USING (true);