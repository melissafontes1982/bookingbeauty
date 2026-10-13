export type ScheduleSetting = {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
};

export type BusyInterval = { start: number; end: number };

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "14:30:00" | "14:30" -> minutos desde meia-noite */
export function toMinutes(time: string): number {
  const parts = time.split(":");
  return Number(parts[0] ?? 0) * 60 + Number(parts[1] ?? 0);
}

export function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseISO(isoDate: string): [number, number, number] {
  const parts = isoDate.split("-");
  return [Number(parts[0] ?? 0), Number(parts[1] ?? 1), Number(parts[2] ?? 1)];
}

/** "2026-03-18" -> dia da semana (0 = domingo), sem deslocamento de fuso */
export function weekdayOfDate(isoDate: string): number {
  const [y, m, d] = parseISO(isoDate);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = parseISO(isoDate);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function formatLongDateBR(isoDate: string): string {
  const [, m, d] = parseISO(isoDate);
  const wd = weekdayOfDate(isoDate);
  return `${WEEKDAY_LABELS[wd]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export function formatPriceEUR(value: number): string {
  return value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

export function overlaps(a: BusyInterval, b: BusyInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

const SLOT_STEP = 15;

/**
 * Calcula os horários livres para um serviço em um dia, respeitando o
 * funcionamento, a pausa, os agendamentos existentes (com higienização)
 * e os bloqueios manuais.
 */
export function computeSlots(params: {
  date: string;
  setting: ScheduleSetting | undefined;
  durationMin: number;
  bufferMin: number;
  busy: BusyInterval[];
  nowMinutes?: number | null;
}): string[] {
  const { date, setting, durationMin, bufferMin, busy } = params;
  if (!setting || !setting.is_open) return [];

  const open = toMinutes(setting.open_time);
  const close = toMinutes(setting.close_time);
  const breakStart = setting.break_start ? toMinutes(setting.break_start) : null;
  const breakEnd = setting.break_end ? toMinutes(setting.break_end) : null;

  const slots: string[] = [];
  for (let start = open; start + durationMin <= close; start += SLOT_STEP) {
    const candidate = { start, end: start + durationMin + bufferMin };
    const visible = { start, end: start + durationMin };

    if (params.nowMinutes != null && date === todayISO() && start <= params.nowMinutes) continue;
    if (breakStart != null && breakEnd != null && overlaps(visible, { start: breakStart, end: breakEnd })) {
      continue;
    }
    if (busy.some((b) => overlaps(candidate, b))) continue;

    slots.push(toTime(start));
  }
  return slots;
}

/** Link de contato direto com o número de WhatsApp do espaço. */
export function buildContactWhatsAppLink(phone: string, message?: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const text = message ?? "Olá! Gostaria de mais informações sobre os atendimentos.";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Monta o link do WhatsApp Web com a mensagem de confirmação codificada. */
export function buildWhatsAppLink(params: {
  phone: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  kind?: "confirm" | "cancel" | "remind";
  manageUrl?: string;
}): string {
  const digits = params.phone.replace(/\D/g, "");
  // Numbers are stored with country code; bare 9-digit numbers default to Portugal.
  const withCountry = digits.length <= 9 ? `351${digits}` : digits;
  const message =
    params.kind === "remind"
      ? `Olá, *${params.clientName}*! Passando para lembrar do seu horário de *${params.serviceName}* ` +
        `amanhã, dia *${formatDateBR(params.date)}*, às *${params.time}*. ` +
        (params.manageUrl ? `Se precisar cancelar ou reagendar: ${params.manageUrl}. ` : "") +
        `Até breve!`
      : params.kind === "cancel"
      ? `Olá, *${params.clientName}*! Informamos que o seu agendamento para *${params.serviceName}* ` +
        `marcado para o dia *${formatDateBR(params.date)}* às *${params.time}* foi cancelado. ` +
        `Caso deseje reagendar para outra data ou tenha qualquer dúvida, estamos à disposição.`
      : `Olá, *${params.clientName}*! Seu agendamento para *${params.serviceName}* ` +
        `foi realizado com sucesso para o dia *${formatDateBR(params.date)}* às *${params.time}*. ` +
        (params.manageUrl
          ? `Para cancelar ou reagendar, acesse: ${params.manageUrl} (use os 4 últimos dígitos do seu WhatsApp). Aguardamos você!`
          : `Caso precise desmarcar ou reagendar, entre em contato conosco. Aguardamos você!`);
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

/** Monta um link sms: (app de Mensagens do telemóvel) com texto puro. */
export function buildSmsLink(params: {
  phone: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  kind?: "confirm" | "cancel" | "remind";
  manageUrl?: string;
}): string {
  const digits = params.phone.replace(/\D/g, "");
  const withCountry = digits.length <= 9 ? `351${digits}` : digits;
  const d = formatDateBR(params.date);
  const message =
    params.kind === "remind"
      ? `Olá, ${params.clientName}! Lembrete do seu horário de ${params.serviceName} amanhã, dia ${d}, às ${params.time}. ` +
        (params.manageUrl ? `Para cancelar ou reagendar: ${params.manageUrl}. ` : "") +
        `Até breve!`
      : params.kind === "cancel"
      ? `Olá, ${params.clientName}! Informamos que o seu agendamento para ${params.serviceName} marcado para o dia ${d} às ${params.time} foi cancelado. Caso deseje reagendar ou tenha qualquer dúvida, estamos à disposição.`
      : `Olá, ${params.clientName}! Seu agendamento para ${params.serviceName} foi confirmado para o dia ${d} às ${params.time}. ` +
        (params.manageUrl
          ? `Para cancelar ou reagendar: ${params.manageUrl} (use os 4 últimos dígitos do seu telemóvel).`
          : `Caso precise desmarcar, entre em contato conosco.`);
  return `sms:+${withCountry}?body=${encodeURIComponent(message)}`;
}

export const COUNTRY_CODES = [
  { code: "351", name: "Portugal", flag: "🇵🇹" },
  { code: "55", name: "Brasil", flag: "🇧🇷" },
  { code: "34", name: "Espanha", flag: "🇪🇸" },
  { code: "33", name: "França", flag: "🇫🇷" },
  { code: "44", name: "Reino Unido", flag: "🇬🇧" },
  { code: "49", name: "Alemanha", flag: "🇩🇪" },
  { code: "39", name: "Itália", flag: "🇮🇹" },
  { code: "41", name: "Suíça", flag: "🇨🇭" },
  { code: "352", name: "Luxemburgo", flag: "🇱🇺" },
  { code: "32", name: "Bélgica", flag: "🇧🇪" },
  { code: "31", name: "Países Baixos", flag: "🇳🇱" },
  { code: "1", name: "EUA/Canadá", flag: "🇺🇸" },
  { code: "244", name: "Angola", flag: "🇦🇴" },
  { code: "258", name: "Moçambique", flag: "🇲🇿" },
  { code: "238", name: "Cabo Verde", flag: "🇨🇻" },
] as const;
