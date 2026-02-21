# Projeto Base (Cloudflare Worker + Bun)

## Objetivo

Construir um backend em Cloudflare Workers com:

- `hono` para roteamento HTTP
- `drizzle-orm` para persistencia em D1
- `typescript` como linguagem principal
- `zod` para validacao de payloads e config
- Discord bot via endpoint de Interactions
- `bun` para gerenciamento de dependencias e scripts

## Estrutura Inicial

```txt
src/
  index.ts           # Entrada do Worker
  app.ts             # Composicao de rotas
  config.ts          # Leitura/validacao de env vars com Zod
  types/
    bindings.ts      # Tipos de bindings do Worker
  routes/
    system.routes.ts
    discord.routes.ts
    docs.routes.ts
  controllers/
    system.controller.ts
    discord.controller.ts
  services/
    discord-interaction.service.ts
  models/
    discord-event.model.ts
  db/
    client.ts        # Instancia Drizzle para D1
migrations/
  0001_create_discord_events_table.sql  # Primeira tabela (discord_events)
openapi/
  openapi.json       # Arquivo gerado pelo hono-docs
hono-docs.ts         # Configuracao de geracao da OpenAPI
```

## Rotas Ja Criadas

- `GET /` status basico do servico
- `GET /health` healthcheck
- `POST /discord/interactions` validacao de assinatura + resposta inicial
- `GET /docs` UI da documentacao
- `GET /docs/openapi` JSON OpenAPI

## Variaveis Necessarias

- `DISCORD_PUBLIC_KEY` (secret no Worker)

Defina com Wrangler:

```bash
bunx wrangler secret put DISCORD_PUBLIC_KEY
```

## Fluxo de Trabalho (Bun)

```bash
bun install
bun run docs:generate
bun run cf-typegen
bun run db:migrate:local
bun run dev
```

## Proximos Passos Recomendados

1. Criar comandos slash no Discord (`/ping`, `/help`, etc.).
2. Persistir eventos/comandos em `discord_events` usando Drizzle.
3. Adicionar camada de repositorios para queries mais complexas.
4. Adicionar testes de rota e validacao (Vitest).
5. Configurar deploy em ambiente `staging` e `production`.

## Referencias Cloudflare (consultadas)

- Workers docs: https://developers.cloudflare.com/workers/
- Node.js compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Limits: https://developers.cloudflare.com/workers/platform/limits/
- Discord bot reference em Workers: usar endpoint HTTP e secrets no Worker
