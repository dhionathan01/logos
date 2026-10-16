# ADR-0008: Resiliência a falhas de rede e banco no backend

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

O cliente espera que o sistema "não quebre" com conexão instável e que trate com elegância lentidão ou falhas temporárias do banco. Do lado da frota, um caminhão com sinal ruim pode reenviar o mesmo incidente várias vezes.

## Decisão

**Falhar rápido:**
- `connect_timeout` de 5 s e `statement_timeout` de 5 s no PostgreSQL: uma consulta travada vira erro tratável em vez de prender a requisição e o pool.
- `pool_pre_ping`: conexões mortas (banco reiniciado, rede caída) são descartadas antes do uso.

**Tentar de novo só o que é seguro:**
- O decorator `retry_transient_db_errors` reexecuta o caso de uso inteiro em erros transitórios (`OperationalError`, conexão invalidada): até 3 tentativas com **backoff exponencial e jitter** (0,2 s → 2 s). O jitter evita que várias requisições tentem de novo no mesmo instante.
- Cada tentativa abre a própria transação, então começa limpa.
- Escritas são seguras para repetir porque são protegidas por versão (ADR-0007): se o primeiro commit aconteceu e só a resposta se perdeu, a nova tentativa recebe 409 em vez de aplicar a mudança duas vezes.

**Degradar de forma explícita:**
- Esgotadas as tentativas, a API responde **`503`** com `Retry-After: 5` em Problem Details, e o frontend sabe que pode tentar de novo.
- Qualquer erro inesperado vira `500` em Problem Details, sem stack trace nem detalhes internos na resposta, mas com log completo no servidor.

**Ingestão idempotente:**
- `POST /api/incidents` aceita o cabeçalho `Idempotency-Key`. Um reenvio com a mesma chave devolve o incidente original (`200` + `Idempotent-Replayed: true`) em vez de duplicar. Dois reenvios simultâneos são resolvidos pelo índice único no banco.
- Reutilizar a chave com outro conteúdo retorna `409`, para não esconder erro do cliente.

**Health checks:**
- `/api/health/live` (o processo responde) e `/api/health/ready` (o banco responde), usados pelo Docker e pelo pipeline de deploy.

## Alternativas consideradas

- **Circuit breaker:** útil com várias dependências externas instáveis. Com uma única dependência (o banco) e timeouts curtos, adiciona estado e complexidade sem ganho perceptível. Fica como evolução se surgirem integrações externas.
- **Fila (ex.: RabbitMQ) entre ingestão e banco:** absorveria picos e quedas do banco, mas é infraestrutura demais para a VM de 1 GB e para o volume do MVP.
- **Retry no cliente apenas:** necessário (ver ADR do frontend), mas não substitui o retry no servidor, que é mais rápido e não repassa a instabilidade para a rede do usuário.

## Consequências

- Uma falha momentânea do banco fica invisível para o usuário; uma falha prolongada vira uma mensagem clara de "tente de novo em instantes".
- O tempo máximo de uma requisição com falha fica limitado (cerca de 3 × 5 s mais o backoff), o que é aceitável e previsível.
