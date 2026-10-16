# ADR-0007: Concorrência otimista com versão + atribuição do incidente

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

O enunciado pergunta como garantir que **dois analistas não tentem resolver o mesmo problema ao mesmo tempo**. Essa pergunta tem dois problemas diferentes:

1. **Escrita perdida (lost update):** Ana e Bruno abrem o mesmo incidente; Ana o fecha, Bruno o marca como inconclusivo segundos depois, e a mudança de Ana desaparece em silêncio.
2. **Trabalho duplicado:** mesmo sem sobrescrita, os dois podem estar ligando para o mesmo motorista ao mesmo tempo.

## Decisão

**1. Controle de concorrência otimista (versão).** Cada incidente tem a coluna `version`. Toda alteração envia a versão que o cliente leu, e o repositório grava com:

```sql
UPDATE incidents SET ..., version = version + 1
 WHERE id = :id AND version = :versao_lida
```

Se outra pessoa gravou antes, nenhuma linha é afetada e a API responde **`409 Conflict`** (`/problems/version-conflict`) com o **estado atual** do incidente no corpo, para que a interface mostre o que mudou sem outra requisição. A checagem e a escrita acontecem em um único comando atômico no PostgreSQL, sem janela entre "ler" e "gravar".

**2. Atribuição (claim).** Passar para **Em Investigação** grava o analista como responsável (`assignee_id`). Enquanto o incidente está em investigação, só o responsável pode mudar status ou dados; outro analista recebe **`403`** (`/problems/not-assignee`) com o nome de quem está investigando. O responsável pode **devolver** o incidente (volta para Aberto e libera a atribuição).

**3. Exclusão** também exige a versão e só é permitida para incidentes abertos, ou seja, registrados por engano e ainda não assumidos.

## Alternativas consideradas

- **Lock pessimista (`SELECT ... FOR UPDATE`):** prende a linha enquanto a transação dura. Funciona dentro de uma requisição, mas não protege o tempo em que o analista está lendo a tela, que é onde o conflito real acontece.
- **Lock com expiração ("reservado por 5 min"):** exige um job de expiração e gera locks órfãos quando o navegador fecha. A atribuição explícita com "devolver" é mais clara para o usuário.
- **Last write wins:** simples, mas é exatamente a corrupção silenciosa que o enunciado pede para evitar.
- **`ETag`/`If-Match` em vez de versão no corpo:** é o padrão HTTP e seria equivalente. A versão no corpo foi escolhida por ser mais explícita no contrato e mais simples de demonstrar; migrar para `If-Match` é uma mudança local na rota.

## Consequências

- Nenhuma escrita é perdida em silêncio: todo conflito vira uma resposta tratável pelo frontend.
- O frontend precisa lidar com 409/403: desfazer a atualização otimista, mostrar o estado atual e explicar quem alterou.
- Um teste de integração dispara atualizações simultâneas e verifica que exatamente uma vence.
