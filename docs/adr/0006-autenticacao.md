# ADR-0006: Autenticação com JWT para analistas e API key para a frota

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

A API tem dois tipos de cliente: **analistas** na interface web, que precisam ser identificados para saber quem assumiu cada incidente, e **sistemas da frota** (telemetria, app do motorista), que só enviam novos incidentes. O enunciado pede "segurança básica" e que o avaliador consiga usar a aplicação sem instalação nem cadastro.

## Decisão

- **Analistas:** login com usuário e senha (hash **bcrypt**) que devolve um **JWT HS256** com validade de 8 horas, um turno de trabalho. O token carrega `sub`, `username` e `name`, o que dispensa consulta ao banco a cada requisição.
- **Frota:** `POST /api/incidents` aceita o cabeçalho `X-API-Key` como alternativa ao JWT, comparado em tempo constante (`hmac.compare_digest`).
- **Usuários de demonstração** são criados pelo seed e exibidos na tela de login, para que o avaliador teste o conflito entre dois analistas em duas abas.
- Login com usuário inexistente executa o bcrypt mesmo assim, para que o tempo de resposta não revele quais usuários existem.
- Segredos (`LOGOS_JWT_SECRET`, `LOGOS_INGESTION_API_KEY`) vêm de variáveis de ambiente; os valores padrão só servem para desenvolvimento.

## Alternativas consideradas

- **Sessão em cookie:** exigiria proteção contra CSRF e armazenamento de sessão no servidor.
- **OAuth/OIDC (Auth0, Keycloak):** correto para produção real, mas desproporcional para um MVP avaliado em poucos minutos.
- **Sem autenticação:** impossibilita identificar quem assumiu o incidente, que é o núcleo do controle de concorrência.

## Consequências

- O token fica no `localStorage` do navegador, o que o expõe a XSS. A mitigação é não renderizar HTML vindo do usuário e aplicar uma Content-Security-Policy no nginx. Em produção real, a evolução seria um cookie `HttpOnly`.
- Não há revogação de token antes do vencimento; aceitável para o MVP.
- Rate limit de login fica no nginx (ver ADR de deploy).
