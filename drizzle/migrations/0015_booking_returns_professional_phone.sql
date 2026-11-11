CREATE OR REPLACE FUNCTION public.public_create_booking(
  _service_id uuid, _professional_id uuid, _date date, _time text, _name text, _phone text,
  _notes text DEFAULT NULL, _email text DEFAULT NULL, _nif text DEFAULT NULL, _birth_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  svc record; pro_name text; pro_phone text; cid uuid; ap record; digits text; st int;
BEGIN
  IF length(trim(coalesce(_name,''))) < 2 OR length(_name) > 120 THEN RAISE EXCEPTION 'Nome inválido.'; END IF;
  digits := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  IF length(digits) < 8 OR length(digits) > 20 THEN RAISE EXCEPTION 'Telefone inválido.'; END IF;
  IF length(coalesce(_notes,'')) > 500 THEN RAISE EXCEPTION 'Observações demasiado longas.'; END IF;
  SELECT * INTO svc FROM services WHERE id = _service_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço indisponível.'; END IF;
  IF _professional_id IS NOT NULL THEN
    SELECT p.name, p.phone INTO pro_name, pro_phone FROM professionals p
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
    'name', trim(_name), 'phone', digits, 'professionalPhone', nullif(regexp_replace(coalesce(pro_phone,''), '\D', '', 'g'), ''));
END $$;