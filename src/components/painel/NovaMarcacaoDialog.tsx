import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_CODES, formatLongDateBR, formatPriceEUR, todayISO } from "@/lib/schedule";

const inputClass =
  "w-full rounded-xl border border-border bg-input px-4 py-3 text-base outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring sm:text-sm";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type ClientRow = { id: string; name: string; phone: string };

export function NovaMarcacaoDialog({
  open,
  onOpenChange,
  defaultDate,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  onCreated: (date: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Nova marcação</DialogTitle>
          <DialogDescription>Marque um horário para um cliente, como se ele próprio tivesse marcado.</DialogDescription>
        </DialogHeader>
        {/* O formulário só existe enquanto a janela está aberta, por isso reinicia sempre limpo. */}
        <NovaMarcacaoForm
          defaultDate={defaultDate < todayISO() ? todayISO() : defaultDate}
          onDone={(date) => {
            onOpenChange(false);
            onCreated(date);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function NovaMarcacaoForm({ defaultDate, onDone }: { defaultDate: string; onDone: (date: string) => void }) {
  const queryClient = useQueryClient();
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState<string | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("351");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: services } = useQuery({
    queryKey: ["nm-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_min, price")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: professionals } = useQuery({
    queryKey: ["nm-professionals"],
    queryFn: async () => {
      const [{ data: pros, error: e1 }, { data: links, error: e2 }] = await Promise.all([
        supabase.from("professionals").select("id, name").eq("active", true).order("name"),
        supabase.from("professional_services").select("professional_id, service_id"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return (pros ?? []).map((p) => ({
        ...p,
        serviceIds: (links ?? []).filter((l) => l.professional_id === p.id).map((l) => l.service_id),
      }));
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["nm-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, phone").order("name");
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const servicePros = (professionals ?? []).filter((p) => serviceId && p.serviceIds.includes(serviceId));
  const autoPro = servicePros.length === 1 ? (servicePros[0] ?? null) : null;
  const activeProId = professionalId ?? autoPro?.id ?? null;
  const needsChoice = servicePros.length > 1;
  const proReady = !needsChoice || Boolean(activeProId);

  const { data: slots, isFetching: loadingSlots } = useQuery({
    queryKey: ["nm-slots", serviceId, date, activeProId],
    enabled: Boolean(serviceId) && Boolean(date) && proReady,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_available_slots", {
        _service_id: serviceId,
        _date: date,
        ...(activeProId ? { _professional_id: activeProId } : {}),
      });
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });

  // Lista de clientes cadastrados filtrada pela pesquisa (nome ou telefone).
  const registered = useMemo(() => {
    const q = normalize(search.trim());
    const d = search.replace(/\D/g, "");
    return (clients ?? []).filter(
      (c) => !q || normalize(c.name).includes(q) || (d.length >= 3 && c.phone.includes(d)),
    );
  }, [clients, search]);

  // No modo "novo cliente", avisa se o que se escreve parece alguém que já existe.
  const suggestions = useMemo(() => {
    if (mode !== "new") return [];
    const q = normalize(name.trim());
    const d = phone.replace(/\D/g, "");
    if (q.length < 2 && d.length < 4) return [];
    return (clients ?? [])
      .filter((c) => (q.length >= 2 && normalize(c.name).includes(q)) || (d.length >= 4 && c.phone.includes(d)))
      .slice(0, 4);
  }, [clients, name, phone, mode]);

  const usingExisting = mode === "existing";
  const finalName = usingExisting ? (selectedClient?.name ?? "") : name.trim();
  const finalPhone = usingExisting
    ? (selectedClient?.phone ?? "")
    : `${countryCode}${phone.replace(/\D/g, "").replace(/^0+/, "")}`;
  const phoneDigits = finalPhone.replace(/\D/g, "");
  const canSubmit = Boolean(serviceId && time && proReady && finalName.length >= 2 && phoneDigits.length >= 8);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("public_create_booking", {
        _service_id: serviceId,
        _professional_id: (activeProId ?? null) as unknown as string,
        _date: date,
        _time: time as string,
        _name: finalName,
        _phone: finalPhone,
        ...(notes.trim() ? { _notes: notes.trim() } : {}),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["nm-slots"] });
      onDone(date);
    },
    onError: (e) => setError((e as Error).message),
  });

  const noSlots = Boolean(serviceId) && proReady && !loadingSlots && (slots ?? []).length === 0;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setError(null);
        create.mutate();
      }}
    >
      <label className="block">
        <span className="eyebrow">Serviço</span>
        <select
          required
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            setProfessionalId(null);
            setTime(null);
          }}
          className={`${inputClass} mt-1.5`}
        >
          <option value="">Escolha o serviço…</option>
          {(services ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.duration_min} min · {formatPriceEUR(Number(s.price))}
            </option>
          ))}
        </select>
      </label>

      {autoPro ? (
        <p className="text-sm text-foreground/80">
          <span className="eyebrow mr-2">Profissional</span>
          <span className="font-semibold">{autoPro.name}</span>
        </p>
      ) : null}

      {needsChoice ? (
        <div>
          <span className="eyebrow">Profissional</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {servicePros.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === activeProId}
                onClick={() => {
                  setProfessionalId(p.id);
                  setTime(null);
                }}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${
                  p.id === activeProId ? "bg-primary text-primary-foreground" : "glass-soft text-foreground/80"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <label className="block">
        <span className="eyebrow">Data</span>
        <input
          required
          type="date"
          min={todayISO()}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setTime(null);
          }}
          className={`${inputClass} mt-1.5`}
        />
        {date ? <span className="mt-1 block text-xs text-foreground/60">{formatLongDateBR(date)}</span> : null}
      </label>

      <div>
        <span className="eyebrow">Horário</span>
        <div className="mt-1.5">
          {!serviceId ? (
            <p className="text-xs text-foreground/60">Escolha primeiro o serviço.</p>
          ) : !proReady ? (
            <p className="text-xs text-foreground/60">Escolha primeiro o profissional.</p>
          ) : loadingSlots ? (
            <p className="text-xs text-foreground/60">A procurar horários livres…</p>
          ) : noSlots ? (
            <p className="text-xs text-foreground/70">Não há horários livres neste dia. Experimente outra data.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {(slots ?? []).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={t === time}
                  onClick={() => setTime(t)}
                  className={`min-h-11 rounded-xl text-sm font-semibold ${
                    t === time ? "bg-primary text-primary-foreground" : "glass-soft text-foreground/80"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <span className="eyebrow">Cliente</span>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-foreground/5 p-1">
          {([
            ["existing", "Cliente cadastrado"],
            ["new", "Novo cliente"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                if (value === "new") setSelectedClient(null);
              }}
              className={`min-h-11 rounded-lg px-2 text-sm font-semibold ${
                mode === value ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {usingExisting ? (
          selectedClient ? (
            <div className="glass-soft flex items-center justify-between gap-3 rounded-xl p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selectedClient.name}</p>
                <p className="text-xs text-foreground/60">+{selectedClient.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="min-h-11 shrink-0 rounded-xl px-3 text-xs font-semibold underline underline-offset-2"
              >
                Trocar
              </button>
            </div>
          ) : (clients ?? []).length === 0 ? (
            <p className="text-xs text-foreground/70">
              Ainda não há clientes cadastrados. Use “Novo cliente”.
            </p>
          ) : (
            <div className="space-y-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Procurar por nome ou telefone"
                autoComplete="off"
                className={inputClass}
              />
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border p-1">
                {registered.length ? (
                  registered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClient(c)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-foreground/5"
                    >
                      <span className="truncate font-semibold">{c.name}</span>
                      <span className="shrink-0 text-xs text-foreground/60">+{c.phone}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-xs text-foreground/70">
                    Nenhum cliente encontrado. Use “Novo cliente” para o registar.
                  </p>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do cliente"
              autoComplete="off"
              className={inputClass}
            />
            <div className="flex gap-2">
              <select
                aria-label="Código do país"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="rounded-xl border border-border bg-input px-2 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code + c.name} value={c.code}>
                    {c.flag} +{c.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telemóvel (ex.: 912 345 678)"
                className={`${inputClass} min-w-0 flex-1`}
              />
            </div>
            <p className="text-xs text-foreground/60">O cliente fica registado automaticamente.</p>
            {suggestions.length ? (
              <div className="rounded-xl border border-border p-2">
                <p className="px-2 pb-1 text-xs text-foreground/60">Já é cliente? Toque para escolher:</p>
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedClient(c);
                      setMode("existing");
                    }}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm hover:bg-foreground/5"
                  >
                    <span className="truncate font-semibold">{c.name}</span>
                    <span className="shrink-0 text-xs text-foreground/60">+{c.phone}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <label className="block">
        <span className="eyebrow">Observações (opcional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={2}
          className={`${inputClass} mt-1.5`}
        />
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={!canSubmit || create.isPending}
        className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {create.isPending ? "A guardar…" : "Guardar marcação"}
      </button>
    </form>
  );
}
