# ADR-0013: Auditoria de eventos, SLA por criticidade e indicadores calculados no banco

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

Além de operar a fila, a gestão da central precisa responder: que tipo de incidente mais ocorre? Quais são resolvidos e em quanto tempo? Cumprimos o SLA? Quem assume que tipo de incidente? Até aqui o incidente só guardava quando ocorreu e quando foi alterado pela última vez, o que não permite medir tempo de resposta nem de resolução.

## Decisão

**1. Marcos de tempo no próprio incidente.** Novas colunas:
- `first_claimed_at`: primeira vez em que alguém assumiu (resposta). Não muda se o incidente for devolvido e assumido de novo.
- `closed_at`: quando foi fechado (resolução).

Ficam no incidente, e não só no histórico, porque os indicadores viram agregações simples e indexáveis (`closed_at - reported_at`), sem reconstruir a linha do tempo de cada incidente a cada consulta.

**2. Trilha de auditoria (`incident_events`).** Cada criação, mudança de status e edição grava um evento (tipo, status de/para, autor, instante) **na mesma transação** da alteração. Se a alteração falha ou entra em conflito, nenhum evento é gravado. A trilha alimenta o histórico no detalhe do incidente e permite auditoria ("quem fechou isto?").

**3. SLA por criticidade** (`app/domain/sla.py`), medido a partir de `reported_at`:

| Criticidade | Resposta (assumir) | Resolução (fechar) |
|---|---|---|
| Alta | 15 min | 2 h |
| Média | 30 min | 8 h |
| Baixa | 2 h | 24 h |

"Inconclusivo" não conta como resolvido: o problema não foi resolvido, só deixou de ser investigado. Incidentes ativos que já passaram do prazo de resolução aparecem como **"em violação agora"**, que é o indicador acionável para o supervisor.

**4. Indicadores calculados sob demanda no PostgreSQL** (`GET /api/analytics`), filtrados pelo período de ocorrência:
- resumo: total, ativos, resolvidos, taxa de resolução, tempos médios, cumprimento de SLA, violações em aberto;
- por categoria, por criticidade e por analista (inclusive a matriz analista × categoria);
- série diária de registrados vs. resolvidos, agrupada no fuso do usuário (parâmetro `tz`).

## Alternativas consideradas

- **Derivar tudo da trilha de eventos:** fonte única de verdade, mas cada indicador exigiria funções de janela sobre todos os eventos. Mais lento e mais difícil de explicar.
- **Views materializadas ou um banco analítico (OLAP):** necessário quando o volume chegar a milhões de linhas. Com o volume de um MVP, consultas agregadas com índices respondem em milissegundos. A evolução natural é materializar as séries diárias.
- **SLA configurável pela interface:** útil, mas fora do escopo do MVP. A tabela no domínio é testada e muda em um único lugar.

## Consequências

- Os indicadores refletem o estado real do banco no momento da consulta, sem atraso de processamento.
- A métrica por analista usa o **responsável atual** do incidente. Se um incidente foi devolvido e assumido por outra pessoa, conta para quem ficou com ele; a trilha de eventos guarda o histórico completo para auditorias mais finas.
- Incidentes criados antes desta mudança não têm `first_claimed_at`/`closed_at`. A migração os preenche a partir do estado atual, de forma aproximada.
