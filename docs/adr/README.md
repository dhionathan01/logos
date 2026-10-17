# Architecture Decision Records

Cada decisão de arquitetura relevante é registrada aqui, no formato curto de ADR (contexto → decisão → consequências). ADRs não são editados depois de aceitos: se uma decisão muda, um novo ADR o substitui e o antigo é marcado como `Substituído por ADR-XXXX`.

| # | Decisão | Status |
|---|---|---|
| [0001](0001-registrar-decisoes-em-adr.md) | Registrar decisões em ADR | Aceito |
| [0002](0002-monorepo.md) | Monorepo com backend, frontend e infra | Aceito |
| [0003](0003-fastapi-sqlalchemy-postgres.md) | FastAPI + SQLAlchemy + PostgreSQL | Aceito |
| [0004](0004-arquitetura-em-camadas.md) | Arquitetura em camadas no backend | Aceito |
| [0005](0005-ciclo-de-vida-do-incidente.md) | Ciclo de vida do incidente como máquina de estados | Aceito |
| [0006](0006-autenticacao.md) | JWT para analistas e API key para a frota | Aceito |
| [0007](0007-concorrencia-otimista-e-atribuicao.md) | Concorrência otimista com versão + atribuição | Aceito |
| [0008](0008-resiliencia-e-idempotencia.md) | Resiliência a falhas de rede e banco no backend | Aceito |
| [0010](0010-design-tokens-e-design-da-informacao.md) | Design tokens da AutoU e design da informação | Aceito |

Modelo: [`template.md`](template.md).
