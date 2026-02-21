# Muddy Sunset Worker

Starter limpo para evoluir o projeto com:

- Hono (HTTP router)
- Drizzle ORM (D1/SQLite)
- TypeScript
- Zod (validações)
- Discord bot por Interactions
- Bun como package manager/runtime de desenvolvimento
- Estrutura MVC
- Documentacao OpenAPI automatica com `hono-docs`

## Primeiros passos

```bash
bun install
bun run docs:generate
bun run dev
```

## Banco local (D1)

```bash
bun run db:migrate:local
```

## Deploy

```bash
bun run deploy
```

## Documento de arquitetura

Veja `PROJECT.md` para escopo, estrutura sugerida e próximos passos do projeto.

## Docs da API

- UI: `GET /docs`
- JSON OpenAPI: `GET /docs/openapi`
