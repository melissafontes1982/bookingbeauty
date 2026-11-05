CREATE TABLE public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  bio text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT ALL ON public.professionals TO service_role;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY professionals_admin_all ON public.professionals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.professional_services (
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  PRIMARY KEY (professional_id, service_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_services TO authenticated;
GRANT ALL ON public.professional_services TO service_role;
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY professional_services_admin_all ON public.professional_services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.appointments ADD COLUMN professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN professional_name text;