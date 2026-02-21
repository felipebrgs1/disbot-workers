# Roadmap de Desenvolvimento: Bot Discord + IA (Cloudflare Workers)

Aqui está o planejamento passo a passo das tarefas necessárias para implementar a arquitetura via Polling (Cron Trigger) e a Inteligência Artificial (Gemini), conforme combinamos.

## 1. Cloudflare Workers & Banco de Dados D1

- [x] Inicializar projeto com Bun, Hono e Drizzle.
- [x] Instalar o SDK do Google Gemini (`@google/genai`).
- [x] Configurar linter e formatter (Oxlint e Oxcfmt).
- [x] Criar schema do banco de dados D1 (Tabelas: `bot_state` e `messages`).
- [x] Gerar migrations através do comando `bun run generate` do Drizzle Kit.
- [x] Aplicar migrations no Cloudflare D1 local (`bun run db:migrate:local`).
- [x] Obter credenciais (Discord Bot Token, Discord Client ID, Google Gemini API Key) e adicioná-las ao `.env` para ambiente local e via wrangler secrets para prod.
- [x] Confirmar o mapeamento das variáveis de ambiente na validação do `config.ts`.

## 2. Ingestão de Histórico do Discord (Polling via Cron)

Como optamos por evitar o timeout de 3 segundos do Gateway Serverless, o worker vai sincronizar as mensagens sozinho.

- [x] **Configuração do Gatilho:** Adicionar o `[triggers]` no arquivo `wrangler.json` (ex: rodar a cada 5 minutos usando a sintaxe cron).
- [x] **Modificar o Entrypoint (`index.ts`):** Adicionar o handler `scheduled(event, env, ctx)` ao lado do `fetch(request, env, ctx)` nativo do Hono.
- [x] **Serviço de Sincronização:** Criar função assíncrona que consome o endpoint `GET /channels/{channel.id}/messages` da API do Discord.
- [x] **Gerenciamento de Estado:** Ler da tabela `bot_state` o último ID de mensagem capturado (`last_message_id`) para usar no parâmetro `after` da API do Discord. Isso previne ler mensagens duplicadas.
- [x] **Persistência no D1:** Salvar as novas mensagens capturadas na tabela `messages`.
- [x] **Atualização de Estado:** Após finalizar, salvar o último ID lido na tabela `bot_state`.

## 3. Integração com IA (Google Gemini 2.5 Flash)

- [ ] **Identificação de Menção:** Nas novas mensagens ingeridas pelo Cron Job, filtrar as mensagens cujo `content` contenha o ID do nosso Bot (menção `@Bot`).
- [ ] **Resgate de Contexto:** Quando for marcado, consultar o D1 para puxar as últimas `X` (ex: 50 a 100) mensagens do canal para criar contexto.
- [ ] **Formatação do Prompt:** Construir um system prompt consistente e enviar o array de mensagens como contexto usando a API do `@google/genai`.
- [ ] **Envio para o Discord:** Enviar o resultado devolvido pela IA de volta ao canal do Discord original via o endpoint REST da API do Discord (`POST /channels/{channel.id}/messages`).
- [ ] _(Opcional)_ Lidar com erros de Rate Limit da IA/Discord ou respostas vazias.

## 4. Deploy e Validação

- [ ] Rodar `bun run check` e linter / formatadores locais.
- [ ] Executar o `bun run deploy` para atualizar os workers na nuvem Cloudflare.
- [ ] Testar uma "marcação" real no grupo e ver o comportamento do Cron Job.
