# ADR-0002: Monorepo com backend, frontend e infra

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

A entrega exige uma API em Python e uma interface em React que se comunicam por um contrato HTTP. O avaliador recebe um único link de repositório, e o pipeline de CI/CD precisa validar os dois lados juntos: uma mudança no contrato da API não pode quebrar o frontend sem que o CI perceba.

## Decisão

Um único repositório com três áreas independentes:

```
backend/    API FastAPI (Python)
frontend/   SPA React + Vite (TypeScript)
infra/      Docker Compose, nginx e scripts de deploy
docs/       ADRs e documentação de produto
```

Cada área tem suas próprias dependências e ferramentas; não há ferramenta de monorepo (Nx, Turborepo). Os workflows de CI rodam por área usando filtros de caminho.

## Alternativas consideradas

- **Dois repositórios (api e web):** dobra a configuração de CI e dificulta validar mudanças de contrato em um único pull request.
- **Ferramenta de monorepo (Nx/Turborepo):** resolve problemas de cache e grafo de dependências que um projeto com dois pacotes não tem.

## Consequências

- Um pull request pode alterar API e interface juntas, com CI validando as duas.
- O contrato da API (OpenAPI) pode gerar os tipos do frontend dentro do mesmo repositório.
- Os workflows precisam de filtros de caminho para não rodar tudo a cada mudança.
