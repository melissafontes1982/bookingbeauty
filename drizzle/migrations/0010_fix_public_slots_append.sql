CREATE OR REPLACE FUNCTION public.public_available_slots(_service_id uuid, _date date, _professional_id uuid DEFAULT NULL)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  svc record; st record;
  t int; o int; c int; bs int; be int; dur int; buf int;
  now_local timestamp := (now() AT TIME ZONE 'Europe/Lisbon');
  res text[] := '{}';
BEGIN
  SELECT * INTO svc FROM services WHERE id = _service_id AND active;
  IF NOT FOUND OR _date < now_local::date THEN RETURN res; END IF;
  SELECT * INTO st FROM schedule_settings WHERE weekday = extract(dow FROM _date)::int;
  IF NOT FOUND OR NOT st.is_open THEN RETURN res; END IF;
  dur := svc.duration_min; buf := svc.buffer_min;
  o := extract(epoch FROM st.open_time)::int / 60;
  c := extract(epoch FROM st.close_time)::int / 60;
  bs := CASE WHEN st.break_start IS NULL THEN NULL ELSE extract(epoch FROM st.break_start)::int / 60 END;
  be := CASE WHEN st.break_end IS NULL THEN NULL ELSE extract(epoch FROM st.break_end)::int / 60 END;
  t := o;
  WHILE t + dur <= c LOOP
    IF NOT (_date = now_local::date AND t <= extract(hour FROM now_local)::int * 60 + extract(minute FROM now_local)::int)
       AND NOT (bs IS NOT NULL AND be IS NOT NULL AND t < be AND bs < t + dur)
       AND NOT EXISTS (
         SELECT 1 FROM appointments a
         WHERE a.appointment_date = _date AND a.status <> 'cancelado'
           AND (_professional_id IS NULL OR a.professional_id = _professional_id)
           AND t < extract(epoch FROM a.end_time)::int / 60 + coalesce(a.buffer_min, 0)
           AND extract(epoch FROM a.start_time)::int / 60 < t + dur + buf)
       AND NOT EXISTS (
         SELECT 1 FROM schedule_blocks b WHERE b.block_date = _date
           AND t < extract(epoch FROM b.end_time)::int / 60
           AND extract(epoch FROM b.start_time)::int / 60 < t + dur + buf)
    THEN
      res := array_append(res, lpad((t / 60)::text, 2, '0') || ':' || lpad((t % 60)::text, 2, '0'));
    END IF;
    t := t + 15;
  END LOOP;
  RETURN res;
END $$;