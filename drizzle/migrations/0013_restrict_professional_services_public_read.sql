DROP POLICY IF EXISTS professional_services_public_read ON public.professional_services;
CREATE POLICY professional_services_public_read ON public.professional_services
FOR SELECT TO anon
USING (
  EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.active = true)
  AND EXISTS (SELECT 1 FROM public.services s WHERE s.id = service_id AND s.active = true)
);