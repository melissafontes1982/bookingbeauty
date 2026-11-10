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
      res := res || lpad((t / 60)::text, 2, '0') || ':' || lpad((t % 60)::text, 2, '0');
    END IF;
    t := t + 15;
  END LOOP;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.public_create_booking(
  _service_id uuid, _professional_id uuid, _date date, _time text, _name text, _phone text,
  _notes text DEFAULT NULL, _email text DEFAULT NULL, _nif text DEFAULT NULL, _birth_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  svc record; pro_name text; cid uuid; ap record; digits text; st int;
BEGIN
  IF length(trim(coalesce(_name,''))) < 2 OR length(_name) > 120 THEN RAISE EXCEPTION 'Nome inválido.'; END IF;
  digits := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  IF length(digits) < 8 OR length(digits) > 20 THEN RAISE EXCEPTION 'Telefone inválido.'; END IF;
  IF length(coalesce(_notes,'')) > 500 THEN RAISE EXCEPTION 'Observações demasiado longas.'; END IF;
  SELECT * INTO svc FROM services WHERE id = _service_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço indisponível.'; END IF;
  IF _professional_id IS NOT NULL THEN
    SELECT p.name INTO pro_name FROM professionals p
      JOIN professional_services ps ON ps.professional_id = p.id AND ps.service_id = _service_id
      WHERE p.id = _professional_id AND p.active;
    IF pro_name IS NULL THEN RAISE EXCEPTION 'Profissional indisponível para este serviço.'; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_date::text));
  IF NOT (_time = ANY(public.public_available_slots(_service_id, _date, _professional_id))) THEN
    RAISE EXCEPTION 'Este horário acabou de ser ocupado. Escolha outro, por favor.';
  END IF;
  SELECT id INTO cid FROM clients WHERE phone = digits LIMIT 1;
  IF cid IS NOT NULL THEN
    UPDATE clients SET name = trim(_name),
      email = coalesce(nullif(trim(_email),''), email),
      nif = coalesce(nullif(trim(_nif),''), nif),
      birth_date = coalesce(_birth_date, birth_date)
    WHERE id = cid;
  ELSE
    INSERT INTO clients (name, phone, notes, email, nif, birth_date)
    VALUES (trim(_name), digits, nullif(trim(_notes),''), nullif(trim(_email),''), nullif(trim(_nif),''), _birth_date)
    RETURNING id INTO cid;
  END IF;
  st := split_part(_time, ':', 1)::int * 60 + split_part(_time, ':', 2)::int + svc.duration_min;
  INSERT INTO appointments (client_id, service_id, client_name, client_phone, service_name, professional_id, professional_name,
    appointment_date, start_time, end_time, buffer_min, status, notes)
  VALUES (cid, svc.id, trim(_name), digits, svc.name, _professional_id, pro_name, _date, _time::time,
    make_time(st / 60, st % 60, 0), svc.buffer_min, 'confirmado', nullif(trim(_notes),''))
  RETURNING id, manage_token INTO ap;
  RETURN jsonb_build_object('id', ap.id, 'token', ap.manage_token, 'serviceName', svc.name,
    'professionalName', pro_name, 'price', svc.price, 'date', _date::text, 'time', _time,
    'name', trim(_name), 'phone', digits);
END $$;

REVOKE ALL ON FUNCTION public.public_available_slots(uuid, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_create_booking(uuid, uuid, date, text, text, text, text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_available_slots(uuid, date, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_create_booking(uuid, uuid, date, text, text, text, text, text, text, date) TO anon, authenticated;