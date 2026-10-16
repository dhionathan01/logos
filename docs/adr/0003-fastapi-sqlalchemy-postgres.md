# ADR-0003: FastAPI + SQLAlchemy + PostgreSQL

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

A API precisa ser em Python, validar rigorosamente qualquer entrada, persistir incidentes e garantir que duas atualizações simultâneas do mesmo incidente não corrompam o estado. O servidor de produção é uma VM com 1 GB de RAM.

## Decisão

- **FastAPI** como framework HTTP: validação declarativa com Pydantic v2, documentação OpenAPI gerada automaticamente e injeção de dependências nativa.
- **SQLAlchemy 2.0 (modo síncrono)** com driver **psycopg 3**: os endpoints são funções síncronas que o FastAPI executa em um pool de threads.
- **PostgreSQL 16** como banco, com **Alembic** para migrações versionadas.

## Alternativas consideradas

- **Django + DRF:** completo, mas traz ORM, admin e convenções que este MVP não usa; mais peso para a VM de 1 GB.
- **Flask:** exigiria montar validação, serialização e OpenAPI manualmente.
- **SQLAlchemy assíncrono (asyncpg):** ganho de throughput irrelevante para dezenas de analistas, com custo extra de complexidade nos testes e no código.
- **SQLite ou arquivo JSON:** o SQLite bloqueia o banco inteiro em escritas e o JSON não oferece transação; os dois enfraquecem justamente o critério de integridade sob concorrência.

## Consequências

- A atualização condicional (`UPDATE ... WHERE version = :v`) é atômica no PostgreSQL, base do controle de concorrência (ADR-0007).
- `statement_timeout` e `connect_timeout` do PostgreSQL permitem falhar rápido em vez de travar requisições.
- O PostgreSQL precisa de ajuste de memória para caber na VM (ver ADR de deploy).
