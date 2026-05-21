# Burger Queen Assistant

Assistente conversacional em **CLI** para uma hamburgueria fictícia. MVP técnico com foco em **memória curta**, **memória longa persistente**, **RAG** sobre base privada, **múltiplos usuários** e **personalização** demonstrável, com modo debug para transparência nas decisões do sistema.

> **Status:** CLI com SQLite e **knowledge base** (15 documentos em `knowledge-base/`). Próximo: ingestão Chroma (`seed:kb`), RAG e integração OpenAI.

---

## Visão geral

O assistente responde sobre cardápio, restrições alimentares, combos e políticas da **Burger Queen**. Cada cliente terá histórico e fatos isolados; o sistema decidirá quando usar documentos (RAG), memória de longo prazo ou só o contexto recente da conversa.

### O que já funciona

| Recurso | Estado |
|---------|--------|
| Loop interativo na CLI | Disponível |
| `/help`, `/login`, `/whoami`, `/history`, `/exit` | Disponível |
| Usuário ativo em memória (sessão) | Disponível |
| Prompt dinâmico (`Ana > `) | Disponível |
| SQLite — usuários e mensagens por `user_id` | Disponível |
| Knowledge base — 15 docs Markdown (cardápio, alérgenos, FAQ…) | Disponível |
| Ingestão Chroma / retrieval (RAG) | Em desenvolvimento |
| Respostas do assistente (IA) | Em desenvolvimento |
| Memória longa, orquestração, debug | Em desenvolvimento |

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
| `npm run test` | Vitest | Aguarda testes em `tests/` |
| `npm run seed:kb` | Indexa `knowledge-base/` no Chroma | Stub |
| `npm run seed:demo` | Usuários demo (Ana, Bruno) | Stub |
| `npm run reset:db` | Recria SQLite local | Stub |
| `npm run eval` | Evals → `evals/results/` | Stub |

---

## CLI

### Comandos disponíveis hoje

```txt
/help            Lista comandos
/login <nome>    Cria ou recupera usuário no SQLite e define sessão ativa
/whoami          Mostra usuário ativo
/history         Lista mensagens do usuário ativo (isolado por usuário)
/exit            Encerra a aplicação
```

Mensagens sem `/` são salvas no banco; o assistente ainda não responde (placeholder até a integração com LLM).

### Exemplo rápido

```bash
npm run chat
```

```txt
Burger Queen Assistant
Digite /help para ver os comandos.

> /login ana
Usuário ativo: Ana
Ana > Quero algo sem bacon.
(Mensagem salva. O assistente ainda não responde nesta fase — use /history.)
Ana > /history
user: Quero algo sem bacon.
Ana > /exit
Até logo!
```

### Comandos planejados (MVP completo)

```txt
/facts   /debug on|off   /reset
```

### Como demonstrar (roteiro alvo — após MVP completo)

1. `npm run seed:kb` e `npm run seed:demo`
2. `npm run chat` → `/login ana` → mencionar intolerância à lactose
3. Perguntar recomendação de burger → resposta usa memória + RAG
4. `/login bruno` → mesma pergunta → resposta diferente (sem os fatos da Ana)
5. `/debug on` → intent, documentos recuperados e fatos salvos
6. Reiniciar a CLI → `/login ana` → `/facts` → memória persistiu

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
evals/             # casos e relatórios
tests/
data/              # SQLite local (gitignored)
```

### Knowledge base

Conteúdo fictício da **Burger Queen** (Salvador, Pituba) para o RAG: cardápio, smash, opções sem lactose, alérgenos, combos, bebidas, horários, entrega, fidelidade, recomendações por perfil e FAQ.

```bash
ls knowledge-base
# 01-visao-cardapio.md … 15-faq.md
```

A indexação no Chroma ainda não está implementada — use `npm run seed:kb` quando o script estiver pronto (issue seguinte).

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
| Ingestão Chroma + serviço RAG | Próximo |
| Memória longa + orquestração + debug + evals | Planejado |

---

## Licença

ISC — ver [`package.json`](package.json).

---

## Autor

**Lucas Oitaven** — projeto de desafio técnico.

Repositório: [github.com/lucas-oitaven/burger-queen-ai-assistant](https://github.com/lucas-oitaven/burger-queen-ai-assistant)
