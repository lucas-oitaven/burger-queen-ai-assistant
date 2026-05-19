# Burger Queen Assistant

Assistente conversacional em **CLI** para uma hamburgueria fictícia. MVP técnico com foco em **memória curta**, **memória longa persistente**, **RAG** sobre base privada, **múltiplos usuários** e **personalização** demonstrável, com modo debug para transparência nas decisões do sistema.

> **Status:** setup inicial pronto (`typecheck`, `chat` e scripts base). CLI interativa, SQLite, RAG e integração OpenAI/ChromaDB estão nas próximas entregas.

---

## Visão geral

O assistente responde sobre cardápio, restrições alimentares, combos e políticas da **Burger Queen**. Cada cliente tem histórico e fatos isolados; o sistema escolhe quando usar documentos (RAG), memória de longo prazo ou só o contexto recente da conversa.

### Capacidades planejadas (MVP)

| Área | Descrição |
|------|-----------|
| **Memória curta** | Últimas *N* mensagens por usuário |
| **Memória longa** | Fatos estáveis extraídos, validados e salvos no SQLite |
| **RAG** | Busca semântica em ~15 documentos Markdown via ChromaDB |
| **Multi-usuário** | `/login` na CLI com isolamento por `user_id` |
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
| Interface | CLI |
| LLM / embeddings | OpenAI (`gpt-4o-mini`, `text-embedding-3-small`) |
| RAG | LangChain.js + ChromaDB |
| Persistência | SQLite (`better-sqlite3`) |
| Validação | Zod |
| Testes | Vitest |

---

## Pré-requisitos

- Node.js **20+**
- npm **10+**
- Chave **OpenAI** (para fases com LLM/RAG)
- **ChromaDB** local quando o RAG estiver ativo (ex.: `http://localhost:8000`)

---

## Instalação

```bash
git clone https://github.com/lucas-oitaven/burger-queen-ai-assistant.git
cd burger-queen-ai-assistant
npm install
cp .env.example .env   # Windows: copy .env.example .env
```

Configure `OPENAI_API_KEY` no `.env` antes de rodar fluxos que usem a API (necessário nas fases com LLM/RAG).

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

| Comando | Descrição |
|---------|-----------|
| `npm run chat` | CLI principal |
| `npm run dev` | Alias da CLI |
| `npm run typecheck` | Checagem TypeScript |
| `npm run test` | Vitest (passa quando houver arquivos em `tests/`) |
| `npm run seed:kb` | Indexa `knowledge-base/` no Chroma |
| `npm run seed:demo` | Usuários demo (Ana, Bruno) |
| `npm run reset:db` | Recria SQLite local |
| `npm run eval` | Evals → `evals/results/` |

**Validação do setup atual:**

```bash
npm run typecheck   # deve concluir sem erros
npm run chat        # exibe banner e encerra (loop de comandos na próxima fase)
```

`seed:*`, `reset:db` e `eval` são **stubs**: executam, informam que a lógica ainda não foi implementada e saem com sucesso.

---

## Estrutura do projeto

```txt
src/
  cli.ts
  config/          # env
  database/        # SQLite, schema
  modules/         # chat, users, memory, rag, llm
  scripts/         # seed, reset, evals
  utils/
knowledge-base/    # Markdown para RAG (conteúdo nas próximas fases)
evals/             # casos e relatórios (results/ gerado localmente)
tests/
data/              # SQLite local (gitignored)
```

---

## CLI

Comandos previstos:

```txt
/login <nome>   /whoami   /facts   /history
/debug on|off   /reset    /help    /exit
```

### Como demonstrar (roteiro alvo — após MVP completo)

1. `npm run seed:kb` e `npm run seed:demo`
2. `npm run chat` → `/login ana` → mencionar intolerância à lactose
3. Perguntar recomendação de burger → resposta usa memória + RAG
4. `/login bruno` → mesma pergunta → resposta diferente (sem os fatos da Ana)
5. `/debug on` → intent, documentos recuperados e fatos salvos
6. Reiniciar a CLI → `/login ana` → `/facts` → memória persistiu

---

## Desenvolvimento

Branches: `main` (estável), `develop` (integração), `feature/*` por entrega.

Commits no estilo [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).

### Próximas entregas

1. CLI base (`/help`, `/login`, `/whoami`, `/exit`)
2. SQLite (usuários e mensagens)
3. Knowledge base + ingestão Chroma
4. Memória longa (extração e validação de fatos)
5. Orquestração, debug e evals

---

## Licença

ISC — ver [`package.json`](package.json).

---

## Autor

**Lucas Oitaven** — projeto de desafio técnico.

Repositório: [github.com/lucas-oitaven/burger-queen-ai-assistant](https://github.com/lucas-oitaven/burger-queen-ai-assistant)
