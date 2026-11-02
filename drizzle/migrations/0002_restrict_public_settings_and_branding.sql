DROP POLICY IF EXISTS schedule_public_read ON public.schedule_settings;
DROP POLICY IF EXISTS general_settings_public_read ON public.general_settings;
REVOKE SELECT ON public.schedule_settings FROM anon;
REVOKE SELECT ON public.general_settings FROM anon;
GRANT ALL ON public.schedule_settings TO service_role;
GRANT ALL ON public.general_settings TO service_role;

DROP POLICY IF EXISTS branding_public_read ON storage.objects;
DROP POLICY IF EXISTS branding_admin_insert ON storage.objects;
DROP POLICY IF EXISTS branding_admin_update ON storage.objects;
DROP POLICY IF EXISTS branding_admin_delete ON storage.objects;