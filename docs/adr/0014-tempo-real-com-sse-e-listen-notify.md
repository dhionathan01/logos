# ADR-0014: Tempo real com SSE e PostgreSQL LISTEN/NOTIFY

- **Status:** Aceito (substitui a decisão de polling como mecanismo principal do ADR-0009)
- **Data:** 2026-10-16

## Contexto

O ADR-0009 adiou o tempo real: polling de 5 s atendia à fila. Com o chat entre analistas e os pedidos de passagem de incidente, a latência do polling deixa de ser aceitável: um pedido "posso assumir?" precisa chegar ao responsável na hora, e conflitos precisam ser vistos por todos enquanto acontecem.

## Decisão

**Transporte: Server-Sent Events (`GET /api/stream`).**
- O fluxo em tempo real é de mão única (servidor → clientes). O que o usuário envia continua sendo `POST`, com validação, idempotência e Problem Details já existentes.
- O cliente usa `fetch` com leitura em streaming (e não `EventSource`) para enviar o token no cabeçalho `Authorization`, nunca na URL, onde ficaria em logs de proxy.
- Reconexão com **backoff exponencial** e cabeçalho `Last-Event-ID`: o servidor reenvia, a partir do banco, as mensagens que o cliente perdeu enquanto estava desconectado.
- Batimento (`: ping`) a cada 15 s, para que proxies não fechem conexões ociosas e o cliente detecte uma conexão morta.

**Barramento: PostgreSQL `LISTEN/NOTIFY`.**
- Quem grava uma mensagem ou altera um incidente executa `pg_notify('logos_events', ...)` **na mesma transação**. O PostgreSQL só entrega notificações de transações confirmadas: se a operação falha ou sofre rollback, ninguém é avisado de algo que não aconteceu.
- Cada processo da API mantém **uma** conexão dedicada em `LISTEN` e distribui os eventos para as conexões SSE abertas (fan-out em memória com filas por cliente). Conexões SSE não ocupam conexões do pool do banco.
- Se a conexão de escuta cai, o processo reconecta com backoff; os clientes recuperam o que perderam pelo `Last-Event-ID`.

**Eventos publicados:**

| Tipo | Quando | Uso no cliente |
|---|---|---|
| `chat.message` | mensagem de analista ou do sistema | entra no chat (com id, permite replay) |
| `incident.changed` | criação, mudança de status, edição, passagem | invalida o cache da fila, do detalhe e do painel |

O polling da fila continua como rede de segurança, mas mais espaçado (30 s) enquanto o stream está conectado.

## Alternativas consideradas

- **WebSocket:** bidirecional, mas a direção cliente → servidor já é bem atendida por HTTP. Exige upgrade de protocolo no proxy e reimplementar reconexão e replay, que o SSE já define (`retry`, `Last-Event-ID`).
- **Redis Pub/Sub:** barramento clássico, mas seria mais um serviço na VM de 1 GB, e a publicação não seria transacional com a escrita no PostgreSQL.
- **Continuar com polling curto (1–2 s):** latência ainda perceptível no chat e carga desnecessária no banco com muitos analistas.

## Consequências

- Mensagens e mudanças chegam a todos em menos de um segundo, e o que é avisado sempre reflete uma transação confirmada.
- O nginx precisa de `proxy_buffering off` e timeouts longos na rota do stream.
- O payload do `NOTIFY` tem limite de 8 KB; as mensagens de chat são limitadas a 1.000 caracteres, bem abaixo disso.
- Escala horizontal funciona sem mudança: cada instância escuta o mesmo canal.
