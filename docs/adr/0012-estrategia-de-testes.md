# ADR-0012: Estratégia de testes

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

Os critérios mais sensíveis do desafio (conflito entre analistas, validação de entradas inesperadas, falhas de rede) são justamente os mais difíceis de verificar manualmente. Os testes precisam provar esses comportamentos e rodar a cada pull request.

## Decisão

| Camada | Ferramenta | O que cobre |
|---|---|---|
| Domínio (unitário) | pytest | Máquina de estados, criticidade padrão, política de retry |
| API (integração) | pytest + TestClient + **PostgreSQL real** | Validação, filtros, ordenação, auth, idempotência, 503 em queda do banco, **duas threads assumindo o mesmo incidente ao mesmo tempo** |
| Frontend (unitário) | Vitest | Filtros na URL, formatação de tempo, cliente HTTP |
| Frontend (componente) | Vitest + Testing Library + **MSW** | Estados de loading/erro/vazio, mutação otimista com sucesso, conflito (rollback + estado atual) e queda de rede |
| Contrato | OpenAPI → tipos TS | CI falha se a API mudar sem regenerar os tipos do frontend |
| Pós-deploy | `curl` no health check | Aplicação no ar e falando com o banco |

- **PostgreSQL real, sem SQLite nem mocks de banco, nos testes de integração:** o controle de concorrência depende do comportamento de lock e da atomicidade do `UPDATE` no PostgreSQL. Um banco diferente provaria outra coisa.
- **MSW** intercepta `fetch` na camada de rede, então os componentes são testados com o cliente HTTP real, inclusive o parsing de Problem Details.
- Cobertura mínima de 85% no backend, verificada no CI. A métrica principal, porém, é cobrir os cenários do enunciado, não a porcentagem.

## Alternativas consideradas

- **E2E com Playwright no CI:** valioso, mas exige subir a stack completa a cada PR; o custo de tempo não compensa no prazo do MVP. O smoke test pós-deploy cobre a integração real.
- **SQLite em memória nos testes:** mais rápido, mas não reproduz a concorrência do PostgreSQL.

## Consequências

- O teste de corrida (`test_simultaneous_claims_have_exactly_one_winner`) documenta e protege a principal garantia do sistema.
- A suíte do backend leva cerca de 20 s e a do frontend cerca de 5 s, rápidas o bastante para rodar em todo PR.
