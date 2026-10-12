import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { computeSlots, toMinutes, toTime, type ScheduleSetting } from "./schedule";

const availabilitySchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const bookingSchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  notes: z.string().trim().max(500).optional(),
  email: z.union([z.literal(""), z.string().trim().email().max(255)]).optional(),
  nif: z.string().trim().max(20).optional(),
  birthDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
});

async function loadDay(date: string, serviceId: string, excludeId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: service }, { data: settings }, { data: appointments }, { data: blocks }] =
    await Promise.all([
      supabaseAdmin.from("services").select("*").eq("id", serviceId).maybeSingle(),
      supabaseAdmin.from("schedule_settings").select("*"),
      supabaseAdmin
        .from("appointments")
        .select("id, start_time, end_time, buffer_min")
        .eq("appointment_date", date)
        .neq("status", "cancelado"),
      supabaseAdmin.from("schedule_blocks").select("start_time, end_time").eq("block_date", date),
    ]);

  const busy = [
    ...(appointments ?? []).filter((a) => a.id !== excludeId).map((a) => ({
      start: toMinutes(a.start_time),
      end: toMinutes(a.end_time) + (a.buffer_min ?? 0),
    })),
    ...(blocks ?? []).map((b) => ({ start: toMinutes(b.start_time), end: toMinutes(b.end_time) })),
  ];

  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const setting = (settings ?? []).find((s) => s.weekday === weekday) as ScheduleSetting | undefined;

  return { service, setting, busy };
}

export const getAvailableSlots = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => availabilitySchema.parse(data))
  .handler(async ({ data }) => {
    const { service, setting, busy } = await loadDay(data.date, data.serviceId);
    if (!service) return { slots: [] as string[] };

    const now = new Date();
    const slots = computeSlots({
      date: data.date,
      setting,
      durationMin: service.duration_min,
      bufferMin: service.buffer_min,
      busy,
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
    });

    return { slots };
  });

export const createPublicBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bookingSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { service, setting, busy } = await loadDay(data.date, data.serviceId);

    if (!service || !service.active) {
      throw new Error("Serviço indisponível.");
    }

    const now = new Date();
    const slots = computeSlots({
      date: data.date,
      setting,
      durationMin: service.duration_min,
      bufferMin: service.buffer_min,
      busy,
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
    });

    if (!slots.includes(data.time)) {
      throw new Error("Este horário acabou de ser ocupado. Escolha outro, por favor.");
    }

    const digits = data.phone.replace(/\D/g, "");
    const { data: existing } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("phone", digits)
      .maybeSingle();

    const extra: { email?: string; nif?: string; birth_date?: string } = {};
    if (data.email) extra.email = data.email;
    if (data.nif) extra.nif = data.nif;
    if (data.birthDate) extra.birth_date = data.birthDate;

    let clientId = existing?.id ?? null;
    if (clientId) {
      await supabaseAdmin.from("clients").update({ name: data.name, ...extra }).eq("id", clientId);
    } else {
      const { data: created } = await supabaseAdmin
        .from("clients")
        .insert({ name: data.name, phone: digits, notes: data.notes ?? null, ...extra })
        .select("id")
        .single();
      clientId = created?.id ?? null;
    }

    const start = toMinutes(data.time);
    const { data: appointment, error } = await supabaseAdmin
      .from("appointments")
      .insert({
        client_id: clientId,
        service_id: service.id,
        client_name: data.name,
        client_phone: digits,
        service_name: service.name,
        appointment_date: data.date,
        start_time: data.time,
        end_time: toTime(start + service.duration_min),
        buffer_min: service.buffer_min,
        status: "confirmado",
        notes: data.notes ?? null,
      })
      .select("id, manage_token")
      .single();

    if (error) throw new Error("Não foi possível concluir o agendamento.");

    return {
      id: appointment.id,
      token: appointment.manage_token,
      serviceName: service.name,
      price: Number(service.price),
      date: data.date,
      time: data.time,
      name: data.name,
      phone: digits,
    };
  });

const manageSchema = z.object({
  token: z.string().uuid(),
  phoneLast4: z.string().regex(/^\d{4}$/),
});

async function findManaged(token: string, phoneLast4: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("appointments")
    .select("id, service_id, service_name, appointment_date, start_time, status, client_name, client_phone")
    .eq("manage_token", token)
    .maybeSingle();
  if (!data || !data.client_phone.replace(/\D/g, "").endsWith(phoneLast4)) return null;
  return data;
}

function isPast(date: string, time: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (date !== today) return date < today;
  return toMinutes(time.slice(0, 5)) <= now.getHours() * 60 + now.getMinutes();
}

export const getManagedBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => manageSchema.parse(data))
  .handler(async ({ data }) => {
    const a = await findManaged(data.token, data.phoneLast4);
    if (!a) return { ok: false as const, error: "Dados não conferem. Verifique os 4 últimos dígitos do seu WhatsApp." };
    return {
      ok: true as const,
      booking: {
        serviceId: a.service_id,
        serviceName: a.service_name,
        date: a.appointment_date,
        time: a.start_time.slice(0, 5),
        status: a.status,
        name: a.client_name,
        past: isPast(a.appointment_date, a.start_time),
      },
    };
  });

export const getRescheduleSlots = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => manageSchema.extend({ date: availabilitySchema.shape.date }).parse(data))
  .handler(async ({ data }) => {
    const a = await findManaged(data.token, data.phoneLast4);
    if (!a?.service_id) return { slots: [] as string[] };
    const { service, setting, busy } = await loadDay(data.date, a.service_id, a.id);
    if (!service) return { slots: [] as string[] };
    const now = new Date();
    return {
      slots: computeSlots({
        date: data.date, setting, durationMin: service.duration_min, bufferMin: service.buffer_min,
        busy, nowMinutes: now.getHours() * 60 + now.getMinutes(),
      }),
    };
  });

export const cancelManagedBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => manageSchema.parse(data))
  .handler(async ({ data }) => {
    const a = await findManaged(data.token, data.phoneLast4);
    if (!a) return { ok: false, error: "Dados não conferem." };
    if (a.status === "cancelado") return { ok: false, error: "Este agendamento já está cancelado." };
    if (isPast(a.appointment_date, a.start_time)) return { ok: false, error: "Este horário já passou." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("appointments").update({ status: "cancelado" }).eq("id", a.id);
    if (error) return { ok: false, error: "Não foi possível cancelar. Tente novamente." };
    return { ok: true, error: null };
  });

export const rescheduleManagedBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    manageSchema.extend({ date: bookingSchema.shape.date, time: bookingSchema.shape.time }).parse(data),
  )
  .handler(async ({ data }) => {
    const a = await findManaged(data.token, data.phoneLast4);
    if (!a?.service_id) return { ok: false, error: "Dados não conferem." };
    if (a.status === "cancelado") return { ok: false, error: "Este agendamento está cancelado. Faça um novo agendamento." };
    if (isPast(a.appointment_date, a.start_time)) return { ok: false, error: "Este horário já passou." };
    const { service, setting, busy } = await loadDay(data.date, a.service_id, a.id);
    if (!service) return { ok: false, error: "Serviço indisponível." };
    const now = new Date();
    const slots = computeSlots({
      date: data.date, setting, durationMin: service.duration_min, bufferMin: service.buffer_min,
      busy, nowMinutes: now.getHours() * 60 + now.getMinutes(),
    });
    if (!slots.includes(data.time)) return { ok: false, error: "Este horário acabou de ser ocupado. Escolha outro." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("appointments")
      .update({
        appointment_date: data.date,
        start_time: data.time,
        end_time: toTime(toMinutes(data.time) + service.duration_min),
        buffer_min: service.buffer_min,
      })
      .eq("id", a.id);
    if (error) return { ok: false, error: "Não foi possível reagendar. Tente novamente." };
    return { ok: true, error: null };
  });
