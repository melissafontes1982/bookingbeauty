CREATE TABLE public.client_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  total_sessions integer NOT NULL DEFAULT 1,
  used_sessions integer NOT NULL DEFAULT 0,
  notes text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_packages TO authenticated;
GRANT ALL ON public.client_packages TO service_role;
ALTER TABLE public.client_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_packages_admin_all ON public.client_packages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.package_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  note text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_sessions TO authenticated;
GRANT ALL ON public.package_sessions TO service_role;
ALTER TABLE public.package_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY package_sessions_admin_all ON public.package_sessions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));