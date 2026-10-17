# Logos · Central de Resposta a Incidentes

MVP da plataforma que organiza o caos entre **5.000 caminhões em rota** e a central de decisão de uma operação logística: todos os incidentes em uma única fila, **já ordenada pelo que exige ação primeiro**, com garantia de que dois analistas nunca atuam no mesmo problema ao mesmo tempo.

**Aplicação online:** _URL_PENDENTE_ · **Documentação da API:** _URL_PENDENTE_/api/docs

> **Acesso de demonstração:** a tela de login tem botões "Entrar como Ana" e "Entrar como Bruno" (usuários `ana` e `bruno`, senha `logos2026`).
> Para ver o controle de conflito, entre como Ana em uma janela e como Bruno em uma janela anônima, e tente assumir o mesmo incidente.

---

## Sumário

- [Como o Logos responde ao desafio](#como-o-logos-responde-ao-desafio)
- [Arquitetura](#arquitetura)
- [Rodando localmente](#rodando-localmente)
- [Testes e qualidade](#testes-e-qualidade)
- [CI/CD e deploy](#cicd-e-deploy)
- [API](#api)
- [Bibliotecas e por quê](#bibliotecas-e-por-quê)
- [Decisões de arquitetura (ADRs)](#decisões-de-arquitetura-adrs)
- [Próximos passos](#próximos-passos)

---

## Como o Logos responde ao desafio

| Pergunta do desafio | Resposta no Logos | Onde ver |
|---|---|---|
| **Como apresentar 100 incidentes e o analista priorizar em milissegundos?** | A API já devolve a fila ordenada por **criticidade → status (o que exige ação) → mais antigo**. Cada linha tem faixa lateral colorida, badge com **cor + ícone + texto** (não depende só de cor), tempo aberto em números tabulares e destaque quando um incidente de criticidade alta está aberto há mais de 30 min. No topo, contadores por criticidade que também filtram com um clique. | [ADR-0010](docs/adr/0010-design-tokens-e-design-da-informacao.md) |
| **Gestão por exceção (filtros)** | Filtros por criticidade, categoria, status, **período de ocorrência** (última hora, 6 h, 24 h, 7 dias ou intervalo de datas) e busca textual, **guardados na URL** (compartilháveis, botão voltar funciona). Por padrão, os fechados ficam ocultos: a tela mostra só o que ainda pede ação. | `frontend/src/features/incidents/filters.ts` |
| **Como garantir que dois analistas não resolvam o mesmo problema?** | Duas camadas. **(1) Concorrência otimista:** toda alteração envia a versão lida, e o `UPDATE ... WHERE version = :v` é atômico no PostgreSQL; se alguém gravou antes, a resposta é `409` com o estado atual. **(2) Atribuição:** ao assumir, o incidente passa a ter um responsável, e só ele pode concluí-lo (`403` para os demais). Um teste dispara duas threads simultâneas e verifica que exatamente uma vence. | [ADR-0007](docs/adr/0007-concorrencia-otimista-e-atribuicao.md) |
| **Como o código trata o estado enquanto o banco processa?** | **Atualização otimista com rollback:** a tela muda na hora e a linha mostra "Salvando…". Se a API confirmar, adota a resposta; se recusar, desfaz e mostra o motivo (e quem está com o incidente); se a rede cair, desfaz e avisa. Sem conexão, a alteração fica "Aguardando conexão" e é enviada quando a rede volta. | [ADR-0009](docs/adr/0009-estado-e-resiliencia-no-frontend.md) |
| **Resiliência a rede instável e banco lento** | Backend: timeouts curtos, `pool_pre_ping`, retry com backoff exponencial e jitter só em erros transitórios, `503` + `Retry-After` quando o banco não responde, `Idempotency-Key` na ingestão (caminhão que reenvia não duplica). Frontend: retry com backoff, fila antiga continua visível com aviso se a atualização falhar, banner de offline. | [ADR-0008](docs/adr/0008-resiliencia-e-idempotencia.md) |
| **Validação e entradas inesperadas** | Schemas Pydantic estritos (`extra="forbid"`, limites de tamanho, enums, padrão de placa, data no futuro rejeitada), JSON malformado → `422`, corpo grande → `413`, todo erro em **Problem Details (RFC 9457)**, sem stack trace exposto. | `backend/app/schemas/incident.py` |
| **Segurança básica da API** | JWT para analistas, API key para sistemas da frota (comparação em tempo constante), bcrypt, login sem enumeração de usuários, rate limit no login (429), CSP e headers de segurança no nginx, segredos só em variáveis de ambiente. | [ADR-0006](docs/adr/0006-autenticacao.md) |
| **Visão de gestão (além da operação)** | **Painel analítico** com filtro de período: volume, taxa de resolução, tempos médios de resposta e resolução, **SLA por criticidade** (meta × realizado), incidentes **fora do SLA agora**, série diária registrados × resolvidos, recorte por categoria e **comparação entre analistas**, com mapa de calor de quem assume que tipo de incidente. Cada incidente também tem **histórico de auditoria** (quem fez o quê e quando). | [ADR-0013](docs/adr/0013-auditoria-sla-e-indicadores.md) |
| **Feedback visual, modo claro/escuro, transições** | Skeleton, estados vazios distintos, tela de erro com "tentar novamente", toasts de confirmação, tema claro/escuro (preferência do sistema por padrão, sem piscar), transições curtas e respeito a `prefers-reduced-motion`. | `frontend/src/features/incidents/components/` |

### Ciclo de vida do incidente

```
Aberto ──assumir──► Em investigação ──concluir──► Fechado
  ▲                   │        │
  └────devolver───────┘        └──► Inconclusivo ──retomar──► Em investigação
                                         └──fechar──► Fechado
```

Quem assume vira o responsável; só ele altera o incidente enquanto investiga. Detalhes em [ADR-0005](docs/adr/0005-ciclo-de-vida-do-incidente.md).

---

## Arquitetura

```
┌───────────── Navegador ─────────────┐
│ React + TanStack Query              │   polling 5 s, mutação otimista,
│ (filtros na URL, tema, toasts)      │   retry com backoff
└───────────────┬─────────────────────┘
                │ HTTPS
┌───────────────▼─────────────────────┐
│ nginx do host (TLS, subdomínio)     │   VPS Oracle Cloud
└───────────────┬─────────────────────┘
┌───────────────▼─────────────────────┐   Docker Compose
│ web: nginx (SPA + proxy /api,       │
│      CSP, rate limit)               │
├─────────────────────────────────────┤
│ api: FastAPI                        │   api/ → services/ → domain/
│                                     │          ↘ repositories/ → models/
├─────────────────────────────────────┤
│ db: PostgreSQL 16                   │
└─────────────────────────────────────┘
```

### Estrutura do repositório

```
backend/
  app/
    api/            rotas HTTP e dependências (auth, sessão)
    services/       casos de uso (regras de conflito, atribuição, idempotência)
    domain/         regras puras: enums, máquina de estados, criticidade padrão
    repositories/   todo o SQL fica aqui
    models/         mapeamento ORM
    schemas/        DTOs Pydantic (contrato da API)
    core/           config, banco + retry, segurança, Problem Details
    scripts/        seed de demonstração, exportação do OpenAPI
  alembic/          migrações versionadas
  tests/            unit/ e integration/ (PostgreSQL real)
frontend/
  src/
    api/            cliente HTTP, erros tipados, tipos gerados do OpenAPI
    app/            providers, rotas, shell, error boundary
    features/auth/  sessão e login
    features/incidents/  fila: queries, mutações, filtros, detalhe e histórico
    features/analytics/  painel: indicadores, gráficos, SLA e comparação entre analistas
    shared/         componentes e hooks reutilizáveis
    styles/         design tokens (identidade AutoU) e estilos globais
infra/              compose de produção, nginx do host, bootstrap e deploy da VPS
docs/adr/           decisões de arquitetura
.github/            CI, deploy e template de PR
```

A separação em camadas está justificada no [ADR-0004](docs/adr/0004-arquitetura-em-camadas.md).

---

## Rodando localmente

**Pré-requisitos:** Docker (com Compose) e Node.js 22.

```bash
# 1. Banco + API (aplica migrações e cria os dados de demonstração)
docker compose -f docker-compose.dev.yml up --build

# 2. Frontend (em outro terminal)
cd frontend
npm ci
npm run dev
```

- Interface: http://localhost:5173 (o Vite faz proxy de `/api` para a API)
- API e Swagger: http://localhost:8000/api/docs

### Simulando um caminhão reportando um incidente

```bash
curl -X POST http://localhost:8000/api/incidents \
  -H "X-API-Key: dev-ingestion-key" \
  -H "Idempotency-Key: cam-0421-evt-0001" \
  -H "Content-Type: application/json" \
  -d '{"title":"Pneu furado no eixo traseiro","category":"mechanical_failure","vehicle_id":"CAM-0421","location":"BR-116, km 212"}'
```

Repetir o comando devolve o mesmo incidente (`200` + `Idempotent-Replayed: true`) em vez de duplicar. A criticidade, quando omitida, é derivada da categoria.

### Variáveis de ambiente da API

| Variável | Padrão (dev) | Descrição |
|---|---|---|
| `LOGOS_DATABASE_URL` | `postgresql+psycopg://logos:logos@localhost:5432/logos` | Conexão com o PostgreSQL |
| `LOGOS_JWT_SECRET` | valor de desenvolvimento | Segredo de assinatura dos tokens |
| `LOGOS_INGESTION_API_KEY` | `dev-ingestion-key` | Chave dos sistemas da frota |
| `LOGOS_SEED_DEMO_DATA` | `false` | Cria 3 analistas e 30 dias de incidentes (com histórico e marcos de SLA) se o banco estiver vazio |
| `LOGOS_DB_STATEMENT_TIMEOUT_MS` | `5000` | Tempo máximo de uma consulta |

---

## Testes e qualidade

```bash
# Backend: lint, tipos e testes (usa o PostgreSQL do compose de dev)
docker compose -f docker-compose.dev.yml run --rm api sh -c "ruff check . && mypy app && pytest --cov=app"

# Frontend
cd frontend
npm run typecheck && npx oxlint && npm test
```

- **Backend:** 84 testes, `mypy --strict`. Inclui o teste de corrida entre dois analistas, payloads maliciosos, idempotência, queda do banco, trilha de auditoria (inclusive "conflito não deixa rastro") e os cálculos de SLA e indicadores com dados controlados.
- **Frontend:** 55 testes com Vitest + Testing Library + MSW. Cobre os estados de loading/erro/vazio, a mutação otimista com sucesso, conflito e queda de rede, o painel analítico e a descrição do histórico.
- **Contrato:** o CI regenera os tipos TypeScript a partir do OpenAPI e falha se estiverem desatualizados.

Estratégia completa em [ADR-0012](docs/adr/0012-estrategia-de-testes.md).

---

## CI/CD e deploy

```
Pull request ─► Backend CI + Frontend CI ─► revisão (template de PR) ─► merge
main ─► CIs ─► imagens api/web no GHCR (tag = SHA) ─► SSH na VPS ─► deploy.sh
     ─► health check (API + banco) ─► rollback automático se falhar ─► smoke test público
```

- As imagens são construídas no GitHub, não na VPS (1 GB de RAM).
- Usuário `deploy` dedicado, host key fixada e segredos gerados na própria VPS.
- Primeira configuração da VPS: `infra/scripts/bootstrap-vps.sh`.

Decisão e trade-offs em [ADR-0011](docs/adr/0011-ci-cd-e-deploy-na-vps.md).

---

## API

Documentação interativa em `/api/docs`. Resumo:

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/login` | Login do analista → JWT |
| `GET` | `/api/incidents` | Fila priorizada; filtros `severity`, `category`, `status` (repetíveis), `search`, `reported_from`/`reported_to` (ISO 8601 com fuso), `limit`, `offset` |
| `GET` | `/api/incidents/summary` | Contadores por criticidade e status |
| `GET` | `/api/incidents/{id}` | Detalhe |
| `GET` | `/api/incidents/{id}/events` | Histórico de auditoria (criação, mudanças de status, edições) |
| `GET` | `/api/analytics` | Indicadores: resumo, por categoria, por criticidade (SLA), por analista e série diária; filtros `reported_from`/`reported_to` e `tz` |
| `POST` | `/api/incidents` | Registra incidente (JWT ou `X-API-Key`; aceita `Idempotency-Key`) |
| `PATCH` | `/api/incidents/{id}` | Edita dados (exige `version`) |
| `PATCH` | `/api/incidents/{id}/status` | Assumir, devolver, concluir (exige `version`) |
| `DELETE` | `/api/incidents/{id}?version=N` | Exclui registro aberto feito por engano |
| `GET` | `/api/health/live`, `/api/health/ready` | Liveness e readiness (banco) |

Erros seguem a RFC 9457 (`application/problem+json`). Em conflito, o corpo traz o estado atual em `current`:

```json
{
  "type": "/problems/version-conflict",
  "title": "O incidente foi alterado por outra pessoa",
  "status": 409,
  "detail": "Este incidente foi alterado por outra pessoa enquanto você o visualizava. ...",
  "current": { "id": "…", "status": "investigating", "version": 2, "assignee": { "display_name": "Bruno Lima" } }
}
```

---

## Bibliotecas e por quê

| Biblioteca | Papel | Por que ela |
|---|---|---|
| **FastAPI** | Framework HTTP | Validação declarativa, OpenAPI automático e injeção de dependências, com pouco código |
| **Pydantic v2** | Validação/DTOs | Rejeita dados inesperados na borda; o mesmo schema gera a documentação |
| **SQLAlchemy 2 + psycopg 3** | ORM e driver | `UPDATE` condicional atômico para a concorrência otimista; tipagem moderna |
| **Alembic** | Migrações | Esquema versionado, aplicado no deploy e testado com downgrade no CI |
| **tenacity** | Retry | Backoff exponencial com jitter, aplicado só a erros transitórios |
| **PyJWT + bcrypt** | Autenticação | Padrões consolidados, sem framework de auth pesado |
| **React 19 + Vite** | Interface | SPA estática servida pelo nginx; build rápido |
| **TanStack Query** | Estado do servidor | Cache, polling, retry, mutação otimista com rollback e pausa offline |
| **React Router** | Rotas e URL | Filtros e incidente aberto vivem na URL |
| **sonner** | Toasts | Feedback acessível e discreto das ações |
| **lucide-react** | Ícones | Leves, consistentes, com tree-shaking; ícones reforçam o significado das cores |
| **Vitest + Testing Library + MSW** | Testes de frontend | Testa componentes com o cliente HTTP real, interceptando a rede |
| **pytest, ruff, mypy, oxlint, Prettier** | Qualidade | Lint, formatação e tipos estritos verificados no CI |

Sem biblioteca de componentes de UI nem de gráficos: os componentes usam os design tokens da AutoU (Figtree, navy, azul, laranja), o modal usa o `<dialog>` nativo, que já traz foco preso e ESC, e os gráficos do painel são SVG próprio. Os gráficos têm tooltip, navegação por teclado e tabela equivalente, e as cores foram validadas para daltonismo e contraste nos dois temas.

---

## Decisões de arquitetura (ADRs)

Todas em [`docs/adr/`](docs/adr/README.md):

0001 Registrar decisões em ADR · 0002 Monorepo · 0003 FastAPI + SQLAlchemy + PostgreSQL · 0004 Arquitetura em camadas · 0005 Ciclo de vida como máquina de estados · 0006 Autenticação · 0007 Concorrência otimista + atribuição · 0008 Resiliência e idempotência · 0009 Estado e resiliência no frontend · 0010 Design tokens e design da informação · 0011 CI/CD e deploy · 0012 Estratégia de testes · 0013 Auditoria, SLA e indicadores

---

## Próximos passos

- **Tempo real via SSE** (PostgreSQL `LISTEN/NOTIFY`), substituindo o polling de 5 s.
- **Metas de SLA configuráveis** pela interface e alerta ativo (push/e-mail) quando um incidente entra em violação.
- **Séries diárias materializadas** quando o volume passar de milhões de incidentes.
- Token em cookie `HttpOnly` e usuário `deploy` restrito a um comando SSH forçado.
