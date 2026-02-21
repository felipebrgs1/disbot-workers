**Package manager: bun**

# Cloudflare Workers - Discord Bot com IA (Gemini)

Este projeto é um Bot para Discord que utiliza **Cloudflare Workers** (Serverless/Edge), **Cloudflare D1** (Banco de dados SQLite na nuvem) e a API do **Google Gemini** para responder a menções e mensagens com o contexto do grupo.

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Arquitetura Atual

- **Ambiente:** Cloudflare Workers (Stack Edge, suporta partes do Node.js Runtime via `nodejs_compat`) usando o framework HTTP **Hono**.
- **Path Aliases:** O projeto usa importações limpas (e.g., `@controllers/`, `@services/`, `@db/`, `@config`, `@models/`, `@appTypes/`). Extensões verbosas (*.service.ts) não são mais utilizadas, nomes de arquivos agora são diretos (`cron.ts`, `gemini.ts`).
- **Banco de Dados Mestre:** Cloudflare D1 (SQLite) via Drizzle ORM (`src/db/schema.ts`).
- **Memória de Longo Prazo Semântica (RAG):** Cloudflare **Vectorize** (`discbot-memory`), onde as conversas do DB são transformadas em Embeddings Geométricos (`text-embedding-004`). Nas perguntas em formato Slash Command, o Gemini consulta as 10 memórias matemáticas mais relevantes do canal.
- **Armazenamento Transiente/Sync:** Cloudflare KV (`discbot`) utilizado para _Locks_ de Concorrência do Cron e estado básico.
- **Gatilhos / Ingestão:**
  - **Cron Job (1 Minuto):** Recupera o histórico de canais retroativos via HTTP REST do Discord. Salva mensagens não processadas no SQLite, traduz para *Embeddings* no Vectorize (via `env.VECTORIZE.upsert`), e responde caso descubra menções diretas.
  - **Slash Commands (`/ask`):** O bot recebe chamadas instantâneas Webhook na rota `/discord/interactions`. Utiliza `ctx.waitUntil` para fazer o processamento da Rota de IA no background assíncrono, enviando imediatamente o sinal de "pensando" do Discord (`Type 5: Defer`) que será atualizado no final usando PATCH.
- **IA:** *Google Gemini API 2.5 Flash* (ou *3.0 Preview*) via SDK `@google/genai`. Duas variações de personalidade (Casual e Aprofundada) com forte apelação à contexto através do Vectorize. A IA também detecta ativamente o *Top 5 de Membros* mais frequentes do Canal atual em que está se engajando.

## Regras de Atuação do Agente (IA)

- **Apenas Geração de Código:** A função da IA neste projeto é estritamente fornecer, gerar e refatorar código estrutural.
- **NÃO Executar Comandos de Infra/Deploy:** A IA **NÃO DEVE** rodar comandos como `bun run db:migrate:local`, `bun run deploy`, pushes para o github ou qualquer outra tarefa que altere o estado do banco de dados ou da cloud. Estas tarefas serão executadas manualmente pelo desenvolvedor. A IA apenas instrui os comandos quando aplicável.
- **Tipagens e Interfaces:** Por padrão, é **proibido** definir `types` ou `interfaces` diretamente nos arquivos fonte dos arquivos, rotas e serviços. Todas as tipagens devem ficar na pasta `src/types/` e o uso de validação através do **Zod** é mandatório para dados complexos ou vindo de rotas/serviços externos.

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
