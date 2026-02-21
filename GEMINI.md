# Cloudflare Workers - Discord Bot com IA (Gemini)

Este projeto é um Bot para Discord que utiliza **Cloudflare Workers** (Serverless/Edge), **Cloudflare D1** (Banco de dados SQLite na nuvem) e a API do **Google Gemini** para responder a menções e mensagens com o contexto do grupo.

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Arquitetura Atual

- **Ambiente:** Cloudflare Workers (Stack Edge, suporta partes do Node.js Runtime via `nodejs_compat`)
- **Banco de Dados (DB):** Cloudflare D1 (SQLite) hospedado na nuvem e acessado via Drizzle ORM.
- **Bot Strategy:** Funciona por Eventos / Cron (não utiliza Gateway WebSocket devido a limitações do serverless).
- **IA:** Google Gemini API 2.5 Flash via SDK `@google/genai`.

## Regras de Atuação do Agente (IA)

- **Apenas Geração de Código:** A função da IA neste projeto é estritamente fornecer, gerar e refatorar código estrutural.
- **NÃO Executar Comandos de Infra/Deploy:** A IA **NÃO DEVE** rodar comandos como `bun run db:migrate:local`, `bun run deploy`, pushes para o github ou qualquer outra tarefa que altere o estado do banco de dados ou da cloud. Estas tarefas serão executadas manualmente pelo desenvolvedor. A IA apenas instrui os comandos quando aplicável.

## Drizzle e Migrations (IMPORTANTE)

- Utilize o Drizzle ORM para queries no D1.
- NUNCA crie migrations SQL manualmente neste projeto.
- SEMPRE utilize o comando de geração do `drizzle-kit` para mapear os modelos definidos na pasta `src/models/*.ts`:

```bash
bun run generate
```

_(Isso rodará o script "generate": "drizzle-kit generate" e criará o arquivo .sql correto na pasta `migrations/`)_

## Comandos do Projeto (Bun)

| Command                     | Purpose                                                 |
| --------------------------- | ------------------------------------------------------- |
| `bun run generate`          | Gera as migrations SQL (Drizzle Kit) dos models         |
| `bun run db:migrate:local`  | Aplica as migrations localmente                         |
| `bun run db:migrate:remote` | Aplica as migrations em produção (D1)                   |
| `bun run cf-typegen`        | Generate TypeScript types (`worker-configuration.d.ts`) |
| `bun run dev`               | Local development (`wrangler dev`)                      |
| `bun run deploy`            | Deploy to Cloudflare                                    |

📌 _Sempre rode `bun run cf-typegen` depois de alterar os bindings no `wrangler.json`._

## Cloudflare Docs

- Principal: https://developers.cloudflare.com/workers/
- Node.js compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Erros Cloudflare e limites (`/workers/platform/limits/`)
