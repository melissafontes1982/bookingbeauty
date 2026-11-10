GRANT SELECT (id, name, bio, photo_url, active) ON public.professionals TO anon;
CREATE POLICY professionals_public_read ON public.professionals FOR SELECT TO anon USING (active = true);
GRANT SELECT ON public.professional_services TO anon;
CREATE POLICY professional_services_public_read ON public.professional_services FOR SELECT TO anon USING (true);