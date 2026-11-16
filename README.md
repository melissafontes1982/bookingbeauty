# Studio Eleve — agenda online

Agenda de marcações para massoterapia e estética. Página pública para clientes + painel de administração.

**Tecnologias:** TanStack Start (React, SSR) · Supabase (base de dados e autenticação) · Vercel (alojamento) · Tailwind CSS.

## Pôr a funcionar do zero

### 1. Supabase
1. Crie um projeto em supabase.com.
2. Em **SQL Editor → New query**, cole o conteúdo de `supabase/migrations/20261116000000_initial_schema.sql` e carregue em **Run**.
3. Em **Authentication → Providers → Email**, deixe a opção *Confirm email* ligada.
4. Em **Authentication → URL Configuration**, defina *Site URL* com o endereço do site no Vercel e acrescente-o também em *Redirect URLs* (com `/**` no fim).
5. Em **Authentication → Users → Add user**, crie o acesso de administração (marque *Auto Confirm User*). Os e-mails autorizados a ser administradores estão na função `claim_authorized_admin` (no SQL) e em `src/routes/auth.tsx` e `src/routes/_authenticated/route.tsx`.
6. Em **Project Settings → API**, copie o *Project URL*, a chave *publishable* e a chave *secret* (service role).

### 2. Vercel
1. Importe este repositório do GitHub.
2. Em **Settings → Environment Variables**, crie as variáveis de `.env.example` (para Production **e** Preview).
3. Faça **Deploy** (ou *Redeploy*, sem cache, depois de alterar variáveis).

### 3. Opcional
- **Notificações push:** `npm run vapid` e copie os dois valores para o Vercel.
- **IA** (traduzir serviços e recomendar serviços ao cliente): defina `AI_API_KEY` (ver `.env.example`). Defina um limite de gastos no fornecedor.

## Desenvolver localmente
```
npm install
cp .env.example .env.local   # e preencha os valores
npm run dev
```
