CREATE OR REPLACE FUNCTION public.get_public_professionals()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'bio', p.bio, 'photo_url', p.photo_url,
    'serviceIds', COALESCE((SELECT jsonb_agg(ps.service_id) FROM public.professional_services ps WHERE ps.professional_id = p.id), '[]'::jsonb)
  ) ORDER BY p.name), '[]'::jsonb)
  FROM public.professionals p WHERE p.active = true;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_professionals() TO anon, authenticated;