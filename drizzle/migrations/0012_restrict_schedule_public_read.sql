DROP POLICY IF EXISTS schedule_public_hours_read ON public.schedule_settings;
CREATE POLICY schedule_public_hours_read ON public.schedule_settings FOR SELECT TO anon USING (weekday BETWEEN 0 AND 6);