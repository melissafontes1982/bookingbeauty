import { useQueryClient } from "@tanstack/react-query";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { downloadFile, parseCsv, toCsv } from "@/lib/csv";

type Table = "clients" | "services" | "appointments" | "schedule_settings" | "schedule_blocks" | "general_settings";
const ZIP_FILES: [Table, string][] = [
  ["general_settings", "configuracoes.csv"],
  ["services", "servicos.csv"],
  ["clients", "clientes.csv"],
  ["schedule_settings", "horarios_funcionamento.csv"],
  ["schedule_blocks", "bloqueios_agenda.csv"],
  ["appointments", "agendamentos.csv"],
];

const CLIENT_COLS = ["id", "name", "phone", "email", "nif", "birth_date", "notes"];
const SERVICE_COLS = ["id", "name", "description", "duration_min", "buffer_min", "price", "active"];
const APPT_COLS = [
  "id", "appointment_date", "start_time", "end_time", "client_name", "client_phone",
  "service_name", "status", "notes", "buffer_min", "client_id", "service_id",
];

const today = () => new Date().toISOString().slice(0, 10);
const nul = (v?: string) => (v && v.trim() ? v.trim() : null);
type Row = { id?: string; name: string; phone: string; email?: string; nif?: string; birth_date?: string; notes?: string; description?: string; duration_min?: string; buffer_min?: string; price?: string; active?: string };
const uuidRe = /^[0-9a-f-]{36}$/i;

export function BackupSection() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const clientsInput = useRef<HTMLInputElement>(null);
  const servicesInput = useRef<HTMLInputElement>(null);
  const apptInput = useRef<HTMLInputElement>(null);
  const fullInput = useRef<HTMLInputElement>(null);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
      qc.invalidateQueries();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Ocorreu um erro." });
    } finally {
      setBusy(false);
    }
  }

  async function fetchAll(table: "clients" | "services" | "appointments" | "schedule_settings" | "schedule_blocks" | "general_settings") {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw new Error("Não foi possível ler os dados.");
    return (data ?? []) as Record<string, unknown>[];
  }

  const exportCsv = (table: "clients" | "services" | "appointments", cols: string[], label: string) =>
    run(async () => {
      const rows = await fetchAll(table);
      downloadFile(`${label}-${today()}.csv`, toCsv(cols, rows), "text/csv;charset=utf-8");
      return `${rows.length} registro(s) exportado(s).`;
    });

  const exportFull = () =>
    run(async () => {
      const files: Record<string, Uint8Array> = {};
      for (const [table, file] of ZIP_FILES) {
        const rows = await fetchAll(table);
        const cols = rows[0] ? Object.keys(rows[0]) : [];
        files[file] = strToU8(toCsv(cols, rows));
      }
      const zip = zipSync(files);
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-completo-${today()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      return "Backup completo (ZIP com planilhas CSV) baixado.";
    });

  async function importAppointments(file: File) {
    const rows = parseCsv(await file.text()).filter(
      (r) => r["appointment_date"] && r["start_time"] && r["client_name"] && r["client_phone"] && r["service_name"],
    );
    if (!rows.length) throw new Error("Nenhum agendamento válido (colunas obrigatórias: appointment_date, start_time, client_name, client_phone, service_name).");
    if (!confirm(`Importar ${rows.length} agendamento(s)? Agendamentos com o mesmo identificador serão atualizados.`)) return "Importação cancelada.";
    const existingIds = new Set((await fetchAll("appointments")).map((a) => String(a["id"])));
    const services = await fetchAll("services");
    const svcByName = new Map(services.map((s) => [String(s["name"]).toLowerCase().trim(), s]));
    const clientIds = new Set((await fetchAll("clients")).map((c) => String(c["id"])));
    let created = 0, updated = 0;
    for (const r of rows) {
      const svc = svcByName.get(r["service_name"]!.toLowerCase().trim());
      const start = r["start_time"]!;
      let end = nul(r["end_time"]);
      if (!end) {
        const [h, m] = start.split(":").map(Number);
        const t = (h ?? 0) * 60 + (m ?? 0) + Number(svc?.["duration_min"] ?? 60);
        end = `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
      }
      const values = {
        appointment_date: r["appointment_date"]!,
        start_time: start,
        end_time: end,
        client_name: r["client_name"]!,
        client_phone: r["client_phone"]!,
        service_name: r["service_name"]!,
        status: nul(r["status"]) ?? "confirmado",
        notes: nul(r["notes"]),
        buffer_min: Number(r["buffer_min"] ?? svc?.["buffer_min"] ?? 0) || 0,
        service_id: (nul(r["service_id"]) && services.some((s) => s["id"] === r["service_id"]) ? r["service_id"] : (svc?.["id"] as string | undefined)) ?? null,
        client_id: nul(r["client_id"]) && clientIds.has(r["client_id"]!) ? r["client_id"]! : null,
      };
      const id = r["id"] && uuidRe.test(r["id"]) ? r["id"] : undefined;
      if (id && existingIds.has(id)) {
        const { error } = await supabase.from("appointments").update(values).eq("id", id);
        if (error) throw new Error(`Erro ao atualizar agendamento de ${values.client_name}.`);
        updated++;
      } else {
        const { error } = await supabase.from("appointments").insert({ ...values, ...(id ? { id } : {}) });
        if (error) throw new Error(`Erro ao criar agendamento de ${values.client_name}.`);
        created++;
      }
    }
    return `Agendamentos: ${created} criado(s), ${updated} atualizado(s).`;
  }

  async function importClients(file: File) {
    const rows = (parseCsv(await file.text()) as unknown as Row[]).filter((r) => r.name && r.phone);
    if (!rows.length) throw new Error("Nenhum cliente válido encontrado (colunas name e phone são obrigatórias).");
    if (!confirm(`Importar ${rows.length} cliente(s)? Clientes com o mesmo telefone serão atualizados.`)) return "Importação cancelada.";
    const existing = await fetchAll("clients");
    const byPhone = new Map(existing.map((c) => [String(c["phone"]).replace(/\D/g, ""), String(c["id"])]));
    let created = 0, updated = 0;
    for (const r of rows) {
      const values = { name: r.name, phone: r.phone, email: nul(r.email), nif: nul(r.nif), birth_date: nul(r.birth_date), notes: nul(r.notes) };
      const id = byPhone.get(r.phone.replace(/\D/g, "")) ?? (uuidRe.test(r.id ?? "") && existing.some((c) => c["id"] === r.id) ? r.id : undefined);
      if (id) {
        const { error } = await supabase.from("clients").update(values).eq("id", id);
        if (error) throw new Error(`Erro ao atualizar ${r.name}.`);
        updated++;
      } else {
        const { error } = await supabase.from("clients").insert(values);
        if (error) throw new Error(`Erro ao criar ${r.name}.`);
        created++;
      }
    }
    return `Clientes: ${created} criado(s), ${updated} atualizado(s).`;
  }

  async function importServices(file: File) {
    const rows = (parseCsv(await file.text()) as unknown as Row[]).filter((r) => r.name);
    if (!rows.length) throw new Error("Nenhum serviço válido encontrado (coluna name é obrigatória).");
    if (!confirm(`Importar ${rows.length} serviço(s)? Serviços com o mesmo nome serão atualizados.`)) return "Importação cancelada.";
    const existing = await fetchAll("services");
    const byName = new Map(existing.map((s) => [String(s["name"]).toLowerCase().trim(), String(s["id"])]));
    let created = 0, updated = 0;
    for (const r of rows) {
      const values = {
        name: r.name,
        description: nul(r.description),
        duration_min: Number(r.duration_min) || 60,
        buffer_min: Number(r.buffer_min) || 0,
        price: Number(String(r.price ?? "0").replace(",", ".")) || 0,
        active: !["false", "0", "nao", "não"].includes((r.active ?? "true").toLowerCase()),
      };
      const id = byName.get(r.name.toLowerCase().trim());
      const { error } = id
        ? await supabase.from("services").update(values).eq("id", id)
        : await supabase.from("services").insert(values);
      if (error) throw new Error(`Erro ao salvar ${r.name}.`);
      if (id) updated++; else created++;
    }
    return `Serviços: ${created} criado(s), ${updated} atualizado(s).`;
  }

  async function importFull(file: File) {
    const data: Partial<Record<string, Record<string, unknown>[]>> = {};
    if (file.name.toLowerCase().endsWith(".json")) {
      try { Object.assign(data, JSON.parse(await file.text())); } catch { throw new Error("Arquivo de backup inválido."); }
    } else {
      let entries: Record<string, Uint8Array>;
      try { entries = unzipSync(new Uint8Array(await file.arrayBuffer())); } catch { throw new Error("Arquivo ZIP inválido."); }
      for (const [table, name] of ZIP_FILES) {
        const key = Object.keys(entries).find((k) => k.split("/").pop() === name);
        if (!key) continue;
        data[table] = parseCsv(strFromU8(entries[key]!)).map((r) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === "" ? null : v])),
        );
      }
    }
    if (!data["services"] && !data["clients"] && !data["appointments"]) throw new Error("Arquivo de backup inválido.");
    if (!confirm("Restaurar o backup completo? Registros existentes com o mesmo identificador serão substituídos pelos do arquivo.")) return "Restauração cancelada.";
    const steps: [string, string][] = [
      ["general_settings", "id"], ["services", "id"], ["clients", "id"],
      ["schedule_settings", "weekday"], ["schedule_blocks", "id"], ["appointments", "id"],
    ];
    for (const [table, key] of steps) {
      const rows = data[table];
      if (!rows?.length) continue;
      const { error } = await supabase.from(table as "services").upsert(rows as never, { onConflict: key });
      if (error) throw new Error(`Erro ao restaurar ${table}: ${error.message}`);
    }
    return "Backup restaurado com sucesso.";
  }

  const pick = (fn: (f: File) => Promise<string>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) run(() => fn(f));
  };

  const btn = "rounded-xl border border-border bg-input px-4 py-2.5 text-xs font-semibold text-foreground disabled:opacity-50";
  const primary = "rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50";

  return (
    <div className="glass-soft max-w-xl space-y-5 rounded-2xl p-5">
      <div>
        <p className="eyebrow">Segurança</p>
        <h3 className="mt-1 font-display text-lg font-semibold">Backup e restauração</h3>
        <p className="mt-1 text-xs text-foreground/60">
          Baixe cópias dos seus dados em planilha (CSV) ou um backup completo. Guarde os arquivos em local seguro.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground/70">Exportar</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className={btn} onClick={() => exportCsv("clients", CLIENT_COLS, "clientes")}>Clientes (CSV)</button>
          <button disabled={busy} className={btn} onClick={() => exportCsv("services", SERVICE_COLS, "servicos")}>Serviços (CSV)</button>
          <button disabled={busy} className={btn} onClick={() => exportCsv("appointments", APPT_COLS, "agendamentos")}>Agendamentos (CSV)</button>
          <button disabled={busy} className={primary} onClick={exportFull}>Backup completo (ZIP)</button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground/70">Restaurar</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className={btn} onClick={() => clientsInput.current?.click()}>Importar clientes (CSV)</button>
          <button disabled={busy} className={btn} onClick={() => servicesInput.current?.click()}>Importar serviços (CSV)</button>
          <button disabled={busy} className={btn} onClick={() => apptInput.current?.click()}>Importar agendamentos (CSV)</button>
          <button disabled={busy} className={primary} onClick={() => fullInput.current?.click()}>Restaurar backup completo</button>
        </div>
        <input ref={clientsInput} type="file" accept=".csv,text/csv" hidden onChange={pick(importClients)} />
        <input ref={servicesInput} type="file" accept=".csv,text/csv" hidden onChange={pick(importServices)} />
        <input ref={apptInput} type="file" accept=".csv,text/csv" hidden onChange={pick(importAppointments)} />
        <input ref={fullInput} type="file" accept=".zip,.json,application/zip,application/json" hidden onChange={pick(importFull)} />
      </div>

      {busy ? <p className="text-xs text-foreground/60">Processando…</p> : null}
      {msg ? <p className={`text-xs ${msg.ok ? "text-brand-deep" : "text-destructive"}`}>{msg.text}</p> : null}
    </div>
  );
}
