-- =====================================================================
-- Studio Eleve / BookingBeauty — criação completa da base de dados
-- Cole TUDO isto no Supabase: SQL Editor > New query > Run
-- É seguro correr numa base nova. Não apaga dados existentes.
-- =====================================================================

-- ---------- 1. Papéis (roles) ----------
do $$ begin
  create type public.app_role as enum ('admin');
exception when duplicate_object then null; end $$;

-- ---------- 2. Tabelas ----------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  name_en text,
  description_en text,
  duration_min integer not null default 60,
  buffer_min integer not null default 0,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  nif text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  bio text,
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.professional_services (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (professional_id, service_id)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  professional_id uuid references public.professionals(id) on delete set null,
  client_name text not null,
  client_phone text not null,
  service_name text not null,
  professional_name text,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  buffer_min integer not null default 0,
  status text not null default 'confirmado',
  notes text,
  manage_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);
create index if not exists appointments_date_idx on public.appointments (appointment_date);

create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  total_sessions integer not null default 1,
  used_sessions integer not null default 0,
  notes text,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.package_sessions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.client_packages(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  used_at timestamptz not null default now(),
  note text
);

create table if not exists public.schedule_settings (
  weekday integer primary key check (weekday between 0 and 6),
  is_open boolean not null default true,
  open_time time not null default '09:00',
  close_time time not null default '18:00',
  break_start time,
  break_end time
);

create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  block_date date not null,
  start_time time not null default '00:00',
  end_time time not null default '23:59',
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.general_settings (
  id integer primary key default 1 check (id = 1),
  company_name text not null default 'Studio Eleve',
  business_segment text not null default 'Massoterapia e Estética',
  whatsapp_number text not null default '',
  logo_url text,
  theme_primary text,
  theme_button text,
  theme_button_text text,
  theme_text text,
  theme_background text,
  message_templates jsonb not null default '{}'::jsonb,
  contact_instructions text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------- 3. Dados iniciais ----------
insert into public.general_settings (id) values (1) on conflict (id) do nothing;

insert into public.schedule_settings (weekday, is_open, open_time, close_time, break_start, break_end) values
  (0, false, '09:00', '13:00', null, null),
  (1, true,  '09:00', '18:00', '13:00', '14:00'),
  (2, true,  '09:00', '18:00', '13:00', '14:00'),
  (3, true,  '09:00', '18:00', '13:00', '14:00'),
  (4, true,  '09:00', '18:00', '13:00', '14:00'),
  (5, true,  '09:00', '18:00', '13:00', '14:00'),
  (6, false, '09:00', '13:00', null, null)
on conflict (weekday) do nothing;

-- ---------- 4. Funções de segurança ----------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- Dá o papel de administrador à pessoa que entra, SE o e-mail estiver
-- nesta lista E o e-mail estiver confirmado. Edite a lista se necessário.
create or replace function public.claim_authorized_admin()
returns boolean
language plpgsql security definer set search_path = public
as $$
declare uemail text; confirmed timestamptz;
begin
  if auth.uid() is null then return false; end if;
  select lower(email), email_confirmed_at into uemail, confirmed from auth.users where id = auth.uid();
  if uemail is null or confirmed is null then return false; end if;
  if uemail not in ('humbertobcabral@gmail.com', 'melissafontes1982@gmail.com') then return false; end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin') on conflict (user_id, role) do nothing;
  return true;
end $$;

revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.claim_authorized_admin() from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.claim_authorized_admin() to authenticated, service_role;

-- ---------- 5. Funções públicas de marcação ----------
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

CREATE OR REPLACE FUNCTION public.get_public_professionals()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'bio', p.bio, 'photo_url', p.photo_url,
    'serviceIds', COALESCE((SELECT jsonb_agg(ps.service_id) FROM public.professional_services ps WHERE ps.professional_id = p.id), '[]'::jsonb)
  ) ORDER BY p.name), '[]'::jsonb)
  FROM public.professionals p WHERE p.active = true;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_professionals() TO anon, authenticated;

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

revoke all on function public.public_available_slots(uuid, date, uuid) from public;
revoke all on function public.public_create_booking(uuid, uuid, date, text, text, text, text, text, text, date) from public;
revoke all on function public.get_public_professionals() from public;
grant execute on function public.public_available_slots(uuid, date, uuid) to anon, authenticated;
grant execute on function public.public_create_booking(uuid, uuid, date, text, text, text, text, text, text, date) to anon, authenticated;
grant execute on function public.get_public_professionals() to anon, authenticated;

-- ---------- 6. Permissões e segurança por linha (RLS) ----------
-- Primeiro retira tudo ao público e depois concede só o necessário.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant all on all tables in schema public to service_role;

do $$
declare t text;
begin
  foreach t in array array['services','clients','appointments','professionals','professional_services',
    'client_packages','package_sessions','schedule_settings','schedule_blocks','general_settings','user_roles','push_subscriptions']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Administradores: acesso total às tabelas do painel
do $$
declare t text;
begin
  foreach t in array array['services','clients','appointments','professionals','professional_services',
    'client_packages','package_sessions','schedule_settings','schedule_blocks','general_settings']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format($p$create policy %I on public.%I for all to authenticated
      using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'))$p$, t || '_admin_all', t);
  end loop;
end $$;

-- user_roles: cada pessoa vê o seu papel; administradores gerem todos
grant select, insert, update, delete on public.user_roles to authenticated;
drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles for select to authenticated using (user_id = auth.uid());
drop policy if exists user_roles_admin_all on public.user_roles;
create policy user_roles_admin_all on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- push_subscriptions: cada pessoa gere só as suas
grant select, insert, update, delete on public.push_subscriptions to authenticated;
drop policy if exists "own subs select" on public.push_subscriptions;
drop policy if exists "own subs insert" on public.push_subscriptions;
drop policy if exists "own subs update" on public.push_subscriptions;
drop policy if exists "own subs delete" on public.push_subscriptions;
create policy "own subs select" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own subs insert" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "own subs update" on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own subs delete" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- Visitantes (página pública): só o estritamente necessário
grant select on public.services to anon;
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services for select to anon using (active = true);

grant select (id, company_name, business_segment, whatsapp_number, logo_url, theme_primary, theme_button, theme_button_text, theme_text, theme_background) on public.general_settings to anon;
drop policy if exists general_settings_public_branding_read on public.general_settings;
create policy general_settings_public_branding_read on public.general_settings for select to anon using (id = 1);

grant select (weekday, is_open, open_time, close_time) on public.schedule_settings to anon;
drop policy if exists schedule_public_hours_read on public.schedule_settings;
create policy schedule_public_hours_read on public.schedule_settings for select to anon using (weekday between 0 and 6);

grant select (id, name, bio, photo_url, active) on public.professionals to anon;
drop policy if exists professionals_public_read on public.professionals;
create policy professionals_public_read on public.professionals for select to anon using (active = true);

grant select on public.professional_services to anon;
drop policy if exists professional_services_public_read on public.professional_services;
create policy professional_services_public_read on public.professional_services for select to anon
  using (exists (select 1 from public.professionals p where p.id = professional_id and p.active = true)
     and exists (select 1 from public.services s where s.id = service_id and s.active = true));
