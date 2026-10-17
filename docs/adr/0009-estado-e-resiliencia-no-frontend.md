# ADR-0009: Estado e resiliência no frontend com TanStack Query

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

O analista trabalha sob pressão e a conexão pode oscilar. O enunciado pede que o usuário "nunca fique na dúvida se o sistema travou" e pergunta como a aplicação trata o estado **enquanto o banco processa uma atualização**. Além disso, vários analistas olham a mesma fila, que muda o tempo todo.

## Decisão

**Estado do servidor no TanStack Query; estado de interface na URL.** Não há Redux nem store global de dados:
- Lista, contadores e detalhe são *queries* com cache, chaves organizadas por uma fábrica (`incidentKeys`).
- Filtros e incidente aberto ficam na **URL** (`?severity=high&incident=<id>`): dá para compartilhar o link, o botão voltar funciona e não há estado duplicado.
- A sessão é um store mínimo fora do React (`sessionStore`), lido com `useSyncExternalStore`, para que o cliente HTTP leia o token sem depender da ordem de renderização.

**Atualização da fila:** polling a cada 5 s, mais revalidação ao voltar o foco e ao reconectar. O polling pausa enquanto há uma mudança de status em andamento, para não sobrescrever a atualização otimista.

**Mudança de status otimista, com rollback:**
1. `onMutate`: cancela buscas em andamento, tira um snapshot e aplica a mudança na tela na hora. A linha mostra "Salvando…".
2. Sucesso: troca o dado otimista pela resposta da API, que traz a nova versão.
3. Conflito (`409`/`403`): restaura o snapshot, **adota o estado atual que a API devolveu** no Problem Details e mostra quem está com o incidente.
4. Rede caída: restaura o snapshot e informa que nada foi salvo.
5. Caso especial: se uma nova tentativa recebe 409, mas o estado atual já é exatamente o que o usuário pediu, a primeira tentativa foi gravada e só a resposta se perdeu. A tela trata isso como sucesso.

**Retry no cliente:** queries tentam de novo em erro de rede e 5xx, com backoff exponencial (até 15 s); erros 4xx não são repetidos. Mutações só repetem em erro de rede, o que é seguro porque toda escrita leva a versão (ADR-0007). Sem conexão, o React Query **pausa** as mutações e as envia quando a rede volta; a linha mostra "Aguardando conexão".

**Estados visíveis:** skeleton no primeiro carregamento; lista esmaecida ao trocar filtros (mantém os dados anteriores); estado vazio diferente para "nada com esses filtros" e "operação em dia"; tela de erro com "tentar novamente" só quando **não há** dados; se já há dados e a atualização falha, a fila continua visível com um aviso "exibindo dados de 14:32". Um banner global avisa quando o navegador está offline, e um Error Boundary evita tela branca em erro de renderização.

**Contrato tipado:** os tipos TypeScript são gerados do OpenAPI do backend (`npm run gen:api`); o CI falha se a API mudar sem regenerar os tipos.

## Alternativas consideradas

- **WebSocket/SSE para tempo real:** menor latência, mas exige pub/sub entre processos (LISTEN/NOTIFY ou Redis) e cuidado com proxies. Polling de 5 s atende ao MVP com uma fração da complexidade. O próximo passo natural seria SSE, sem mudar o restante do frontend: bastaria invalidar o cache ao receber um evento.
- **Redux/Zustand com dados do servidor:** reimplementaria cache, retry e sincronização que o TanStack Query já resolve.
- **Atualização pessimista (esperar a API):** mais simples, mas deixa o analista olhando um spinner a cada clique; com a versão no servidor, o otimismo é seguro.

## Consequências

- O analista vê o efeito do clique imediatamente e recebe uma explicação clara quando algo não pôde ser aplicado.
- A tela pode ficar até 5 s atrás do servidor; conflitos nesse intervalo são detectados pela versão, nunca resultam em sobrescrita.
- Os testes de componente (Vitest + MSW) cobrem sucesso, conflito e queda de rede da mutação otimista.
