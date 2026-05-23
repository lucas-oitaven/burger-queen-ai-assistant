# Burger Queen Assistant

Assistente conversacional em **CLI** para uma hamburgueria fictícia. MVP técnico com foco em **memória curta**, **memória longa persistente**, **RAG** sobre base privada, **múltiplos usuários** e **personalização** demonstrável, com modo debug para transparência nas decisões do sistema.

> **Status:** CLI com SQLite, knowledge base (15 docs) e ingestão Chroma (`seed:kb`). Próximo: serviço RAG na CLI e integração OpenAI.

---

## Visão geral

O assistente responde sobre cardápio, restrições alimentares, combos e políticas da **Burger Queen**. Cada cliente terá histórico e fatos isolados; o sistema decidirá quando usar documentos (RAG), memória de longo prazo ou só o contexto recente da conversa.

### O que já funciona

| Recurso | Estado |
|---------|--------|
| Loop interativo na CLI | Disponível |
| `/help`, `/login`, `/whoami`, `/history`, `/facts`, `/exit` | Disponível |
| Usuário ativo em memória (sessão) | Disponível |
| Prompt dinâmico (`Ana > `) | Disponível |
| SQLite — usuários e mensagens por `user_id` | Disponível |
| Knowledge base — 15 docs Markdown (cardápio, alérgenos, FAQ…) | Disponível |
| Ingestão Chroma (`npm run seed:kb`) | Disponível |
| Retrieval RAG na CLI | Em desenvolvimento |
| Respostas do assistente (IA) | Em desenvolvimento |
| Memória longa (`/facts`, extração com OpenAI) | Disponível |
| Orquestração LLM+RAG, debug | Em desenvolvimento |

### Capacidades planejadas (MVP)

| Área | Descrição |
|------|-----------|
| **Memória curta** | Últimas *N* mensagens por usuário |
| **Memória longa** | Fatos estáveis extraídos, validados e salvos no SQLite |
| **RAG** | Busca semântica nos 15 documentos de `knowledge-base/` via ChromaDB |
| **Multi-usuário** | `/login` com isolamento por `user_id` (persistente após SQLite) |
| **Orquestração** | Intent + decisão RAG / memória / resposta direta |
| **Debug** | `/debug on` mostra intent, fontes e fatos usados ou salvos |

**Fora do escopo:** WhatsApp real, deploy, auth complexa, dashboard, streaming e multi-provider.

---

## Arquitetura

Fluxo principal de uma mensagem (visão alvo do MVP):

```txt
CLI → usuário ativo → ChatService
  → persiste mensagem (SQLite)
  → monta contexto (histórico + fatos + sessão)
  → classifica intenção (RAG? memória? risco?)
  → orquestra retrieval (Chroma / fatos / nada)
  → LLM gera resposta personalizada
  → extrai e valida fatos candidatos → salva memória longa
  → persiste resposta → CLI (+ debug opcional)
```

Módulos em `src/modules/`: `chat`, `users`, `memory`, `rag`, `llm`.

---

## Decisões de design

- **CLI primeiro** — interface principal para demo e entrevista, sem depender de frontend.
- **SQLite** — persistência local simples para usuários, mensagens e fatos; adequado ao escopo do desafio.
- **ChromaDB** — vector store para RAG sobre `knowledge-base/` sem acoplar o domínio ao provedor de embeddings.
- **LangChain.js** — retrieval, embeddings e integração OpenAI sem orquestrador pesado no MVP.
- **Memória longa curada** — o LLM não grava no banco; fatos passam por extração, validação e deduplicação antes do SQLite.
- **Isolamento por usuário** — toda leitura/escrita de memória usa `user_id`; RAG é compartilhado, contexto pessoal não.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Runtime | Node.js + TypeScript |
| Interface | CLI (`readline`) |
| LLM / embeddings | OpenAI (`gpt-4o-mini`, `text-embedding-3-small`) |
| RAG | LangChain.js + ChromaDB |
| Persistência | SQLite (`better-sqlite3`) |
| Validação | Zod |
| Testes | Vitest |

---

## Pré-requisitos

- Node.js **20+**
- npm **10+**
- Chave **OpenAI** (necessária nas fases com LLM/RAG)
- **ChromaDB** local quando o RAG estiver ativo (ex.: `http://localhost:8000`)

---

## Instalação

```bash
git clone https://github.com/lucas-oitaven/burger-queen-ai-assistant.git
cd burger-queen-ai-assistant
npm install
cp .env.example .env   # Windows: copy .env.example .env
```

Configure `OPENAI_API_KEY` no `.env` antes de rodar fluxos que usem a API.

`npm install` executa `postinstall` e recompila `better-sqlite3` para a versão do Node em uso. Se você trocar de Node (ex.: 22 → 24) depois do install, rode:

```bash
npm run rebuild:native
```

### Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `OPENAI_API_KEY` | Chave OpenAI |
| `OPENAI_CHAT_MODEL` | Modelo de chat (padrão: `gpt-4o-mini`) |
| `OPENAI_EMBEDDING_MODEL` | Embeddings (padrão: `text-embedding-3-small`) |
| `DATABASE_PATH` | SQLite (padrão: `./data/app.sqlite`) |
| `CHROMA_URL` | Servidor Chroma |
| `CHROMA_COLLECTION` | Coleção (padrão: `burger_queen_knowledge_base`) |
| `DEBUG` | Flag global de debug |

---

## Scripts

| Comando | Descrição | Estado |
|---------|-----------|--------|
| `npm run chat` | CLI principal | Funcional |
| `npm run dev` | Alias da CLI | Funcional |
| `npm run typecheck` | Checagem TypeScript | Funcional |
| `npm run test` | Vitest — suite unitária (`tests/`) | Funcional |
| `npm run test:watch` | Vitest em modo watch | Funcional |
| `npm run test:rag-integration` | Vitest — só `rag.service.test.ts`, integração Chroma ativa | Funcional |
| `npm run rebuild:native` | Recompila `better-sqlite3` para o Node atual | Funcional |
| `npm run seed:kb` | Indexa `knowledge-base/` no Chroma | Funcional |
| `npm run seed:demo` | Usuários demo (Ana, Bruno, Carla) + fatos iniciais no SQLite | Funcional |
| `npm run verify:demo-seed` | Valida seed demo (perfis + isolamento) | Funcional |
| `npm run reset:db` | Apaga e recria SQLite (schema + migrations) | Funcional |
| `npm run eval` | Roda 5 casos de `evals/eval-cases.json` → `evals/results/baseline-results.md` | Funcional |
| `npm run verify:eval-cases` | Valida parse do JSON de casos | Funcional |
| `npm run verify:eval-runner` | Smoke do runner (isolamento + asserções) | Funcional |
| `npm run verify:eval-report` | Smoke do formatter Markdown | Funcional |

---

## CLI

### Comandos disponíveis hoje

```txt
/help            Lista comandos
/login <nome>    Cria ou recupera usuário no SQLite e define sessão ativa
/whoami          Mostra usuário ativo
/history         Lista mensagens do usuário ativo (isolado por usuário)
/facts           Lista fatos ativos do usuário ativo (memória longa)
/exit            Encerra a aplicação
```

Mensagens sem `/` são salvas no banco. Com `OPENAI_API_KEY`, fatos estáveis podem ser extraídos e persistidos (`Fato salvo.` quando aplicável). O assistente ainda não responde com LLM (próxima fase).

### Exemplo rápido

```bash
npm run chat
```

```txt
Burger Queen Assistant
Digite /help para ver os comandos.

> /login ana
Usuário ativo: Ana
Ana > Sou vegetariana e gosto de cogumelos.
Fato salvo.
Ana > /facts
Fatos de Ana:
- Usuária é vegetariana [restriction]
Ana > /history
user: Sou vegetariana e gosto de cogumelos.
Ana > /exit
Até logo!
```

### Comandos planejados (MVP completo)

```txt
/debug on|off   /reset
```

### Como demonstrar (personalização + isolamento)

**Pré-requisitos:** Chroma rodando (`chroma run`), `OPENAI_API_KEY` no `.env`, `npm run reset:db` (se o banco tiver testes antigos), `npm run seed:kb` e `npm run seed:demo`.

Personas criadas pelo seed:

| Login | Perfil (fatos iniciais) |
|-------|-------------------------|
| `ana` | Sem lactose; prefere burgers artesanais (assinatura) |
| `bruno` | Linha smash suculenta; gosta de combos smash |
| `carla` | Vegetariana; prefere opções mais leves |

```bash
npm run verify:demo-seed   # opcional — checagem automática
npm run chat
```

```txt
/login ana
/facts          # lactose + artesanal

/login bruno
/facts          # smash + combo — sem fatos da Ana

/debug on
/login ana
O que você me recomenda hoje?

/login bruno
O que você me recomenda hoje?    # resposta diferente (smash/combo)

/login carla
O que você me recomenda hoje?    # resposta veggie/leve
```

Reinicie a CLI, `/login ana` + `/facts` → fatos do seed continuam no SQLite.

---

## Evals (regressão do orquestrador)

Suíte declarativa em `evals/eval-cases.json` — valida **decisões estruturais** (intent, RAG, memória, isolamento, injection), não a redação exata do LLM.

**Pré-requisitos:** `chroma run`, `OPENAI_API_KEY` no `.env`, `npm run seed:kb`.

```bash
npm run eval
```

O script recria o SQLite e aplica `seed:demo` antes dos casos. Saída: `evals/results/baseline-results.md` (gitignored). Exit code `1` se houver `FAIL` ou `ERROR`.

| Caso | O que valida |
|------|----------------|
| `rag_vegetarian_options` | RAG + doc vegetariano |
| `memory_personalized_recommendation` | Memória longa (Ana seed) |
| `user_isolation_facts` | Fatos Ana ≠ Bruno |
| `prompt_injection_not_saved` | Injection, risk high, 0 fatos |
| `greeting_without_rag` | Saudação sem RAG |

```bash
npm run verify:eval-cases    # JSON + schema
npm run typecheck
```

---

## Estrutura do projeto

```txt
src/
  cli.ts           # Entrada da CLI (implementado)
  config/          # env
  database/        # SQLite, schema
  modules/         # chat, users, memory, rag, llm
  scripts/         # seed, reset, evals
  utils/
knowledge-base/    # 15 Markdown (menu, restrições, combos, FAQ…) — prontos para RAG
evals/
  eval-cases.json  # 5 casos de eval
  results/         # baseline-results.md (gerado)
tests/
data/              # SQLite local (gitignored)
```

### Knowledge base

Conteúdo fictício da **Burger Queen** (Salvador, Pituba) para o RAG: cardápio, smash, opções sem lactose, alérgenos, combos, bebidas, horários, entrega, fidelidade, recomendações por perfil e FAQ.

```bash
ls knowledge-base
# 01-visao-cardapio.md … 15-faq.md
```

### Indexar no Chroma

Com o servidor Chroma ativo e `OPENAI_API_KEY` no `.env`:

```bash
chroma run
# outro terminal:
npm run seed:kb
```

Saída esperada (exemplo): arquivos processados **15**, chunks indexados (dezenas, conforme tamanho dos `.md`), coleção `burger_queen_knowledge_base`.

Reexecutar `seed:kb` **recria** a coleção (sem duplicar chunks). Estratégia de fallback se o Chroma falhar: ver seção abaixo.

### Se o ChromaDB não subir localmente

Ordem recomendada:

1. Subir o servidor: `chroma run` ou `docker run -p 8000:8000 chromadb/chroma`
2. Conferir `CHROMA_URL=http://localhost:8000` no `.env`
3. Rodar `npm run seed:kb` de novo

Se ainda não for possível (ambiente restrito, CI sem Docker, etc.), a ingestão **depende** do Chroma neste MVP — não há índice vetorial alternativo no código ainda. Plano de contingência documentado no projeto: usar `MemoryVectorStore` do LangChain **somente em desenvolvimento** (Issue #6+), mantendo Chroma como alvo de produção/demo. Não execute `seed:kb` sem vector store: o RAG da CLI virá na issue seguinte.

---

## Testes (Vitest)

Suite automatizada dos serviços core (Issue #13). Roda **sem** Chroma nem OpenAI no caminho padrão.

```bash
npm run typecheck
npm run test
```

Após trocar de versão do Node, recompile o módulo nativo do SQLite:

```bash
npm run rebuild:native
```

### Arquivos

| Arquivo | Cobertura |
|---------|-----------|
| `tests/fact-validator.test.ts` | `FactValidatorService` — regras de aceite/rejeição |
| `tests/memory-service.test.ts` | `MemoryService` — pipeline extract → validate → dedup |
| `tests/user-isolation.test.ts` | Isolamento de mensagens e fatos por `user_id` |
| `tests/rag.service.test.ts` | `filterWeakRagResults`, debug snapshot/lines; integração opcional |
| `tests/intent-classifier.test.ts` | Fallback heurístico, parse JSON, `IntentClassifierService` |
| `tests/test-database.test.ts` | Smoke do helper SQLite `:memory:` |
| `tests/helpers/test-database.ts` | Setup compartilhado para testes com DB |

### Integração RAG (opt-in)

`npm run test` **não** exige Chroma — assim a suite passa offline e em CI simples. A busca semântica real (`searchKnowledgeBase`) depende de serviços externos; por isso fica em comando separado:

```bash
chroma run
# outro terminal:
npm run seed:kb
npm run test:rag-integration   # 13 testes em rag.service.test.ts (inclui searchKnowledgeBase live)
```

Pré-requisitos: `OPENAI_API_KEY` no `.env`, Chroma ativo, knowledge base indexada. Equivalente manual: `npm run verify:rag`.

Smoke scripts `verify:*` e evals (`npm run eval`) complementam Vitest para fluxos ponta a ponta com API real.

---

## Desenvolvimento

Branches: `main` (estável), `develop` (integração), `feature/*` por entrega.

Commits no estilo [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).

### Roadmap

| Entrega | Status |
|---------|--------|
| Setup do projeto (TypeScript, scripts, estrutura) | Concluído |
| CLI base (`/help`, `/login`, `/whoami`, `/exit`) | Concluído |
| SQLite (usuários, mensagens, `/history`) | Concluído |
| Knowledge base (15 documentos Markdown) | Concluído |
| Ingestão Chroma (`seed:kb`) | Concluído |
| Serviço RAG + respostas na CLI | Próximo |
| Memória longa + orquestração + debug + evals | Planejado |

---

## Licença

ISC — ver [`package.json`](package.json).

---

## Autor

**Lucas Oitaven** — projeto de desafio técnico.

Repositório: [github.com/lucas-oitaven/burger-queen-ai-assistant](https://github.com/lucas-oitaven/burger-queen-ai-assistant)
