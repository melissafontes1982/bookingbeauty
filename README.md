# Studio Eleven

Atue como um desenvolvedor web especialista em sistemas de agendamento e crie a arquitetura e/ou código para uma plataforma de **Agenda Online para Massoterapia e Estética**.

O sistema deve conter dois módulos principais: uma **Interface Pública para Clientes** e um **Painel de Administração**.

### 1. Requisitos do Sistema:

#### A. Painel Administrativo (Acesso Restrito ao Profissional)

- **Gestão de Serviços:**

  - Cadastro, edição e exclusão de serviços de massoterapia e estética.

  - Campos: Nome do serviço, Descrição, Duração (ex: 30min, 60min, 90min), Preço e Intervalo de tempo entre os atendimentos (para higienização da sala).

- **Gestão de Clientes:**

  - Cadastro manual de clientes (Nome, WhatsApp/Telefone, E-mail, Observações/Ficha de Anamnese simplificada).

  - Histórico de agendamentos por cliente.

- **Gestão de Horários e Agenda:**

  - Configuração do horário de funcionamento (dias da semana, horário de início/fim e pausa para almoço).

  - Visualização da agenda (visão diária, semanal e mensal).

  - Possibilidade do administrador bloquear horários específicos (férias, imprevistos, etc.).

#### B. Áreas Públicas (Agendamento para Clientes)

- **Fluxo do Cliente:**

  1. Escolha do serviço.

  2. Escolha do dia e horário disponível (calculado dinamicamente com base nos horários livres e na duração do serviço).

  3. Preenchimento de dados de contato (Nome e WhatsApp).

  4. Tela de confirmação do agendamento.

#### C. Integração com WhatsApp (Sem API Oficial / Via WhatsApp Web)

Como o sistema **não utilizará a API Oficial do WhatsApp (API Cloud / Business API)**, o disparo deve ser feito diretamente via **link de redirecionamento (`https://wa.me/`)** ou extensão/script local:

- Ao finalizar um agendamento público ou manual no painel, o sistema deve gerar um botão de ação rápida "Enviar Confirmação no WhatsApp".

- Ao clicar no botão, o sistema deve abrir uma nova aba abrindo o WhatsApp Web com uma mensagem pré-formatada contendo os dados do agendamento.

- **Modelo da Mensagem:**

  > "Olá, *[Nome do Cliente]*! Seu agendamento para *[Nome do Serviço]* foi realizado com sucesso para o dia *[Data]* às *[Horário]*. Caso precise desmarcar ou reagendar, entre em contato conosco. Aguardamos você!"

### 2. Tecnologias Recomendadas

- Sugira a melhor pilha de tecnologias simples e eficientes (ex: React / Next.js / Tailwind CSS no frontend e Node.js / Supabase / Firebase no backend).

- O banco de dados deve armazenar: `Serviços`, `Clientes`, `Agendamentos` e `Configurações de Horário`.

### 3. Entregáveis Esperados

1. A estrutura do banco de dados (schema/modelos).

2. O fluxo das telas do cliente e do painel do administrador.

3. O código de exemplo para geração automática do link do WhatsApp Web com os parâmetros codificados (`encodeURIComponent`).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://studioeleve.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/38778ff6-22eb-44f7-b375-68c652753667).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
