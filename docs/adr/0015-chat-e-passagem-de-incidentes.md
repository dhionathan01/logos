# ADR-0015: Chat da central e passagem de incidentes entre analistas

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

A atribuição (ADR-0007) impede trabalho duplicado, mas é rígida: se Bruno tem mais contexto sobre um incidente que Ana assumiu (já falou com o motorista, conhece o trecho), hoje ele só pode esperar Ana devolvê-lo. A coordenação acaba indo para fora do sistema, para o WhatsApp, que é exatamente o caos que o Logos substitui.

## Decisão

**Chat global da central**, com três tipos de mensagem:
- **Analista:** texto livre (até 1.000 caracteres), opcionalmente vinculado a um incidente.
- **Sistema:** gerada automaticamente quando alguém assume, devolve, fecha ou marca um incidente como inconclusivo, e quando **uma tentativa de assumir entra em conflito**. Fica registrada a tentativa, não só o sucesso.
- **Pedido de passagem:** cartão interativo com o estado do pedido.

**Pedido de passagem (handover)**, uma pequena máquina de estados:

```
pending ──aceitar (responsável)──► accepted   (incidente passa para quem pediu)
   ├──recusar (responsável)──────► declined
   └──cancelar (quem pediu)──────► cancelled
```

- Só se pede passagem de incidente **em investigação ou inconclusivo, com responsável**, e não se pede o que já é seu.
- No máximo um pedido pendente por incidente: um índice único parcial no PostgreSQL garante isso mesmo com cliques simultâneos.
- **Aceitar é uma transferência atômica:** `UPDATE ... SET assignee_id = :quem_pediu, version = version + 1 WHERE id = :id AND assignee_id = :responsavel`. Se o responsável mudou nesse meio tempo (devolveu, fechou, outro pedido foi aceito), a transferência falha com conflito em vez de entregar o incidente errado.
- **Delegar** é a mesma transferência iniciada pelo responsável, escolhendo outro analista.
- Toda passagem gera evento de auditoria (`assignee_changed`) e mensagem no chat.

## Alternativas consideradas

- **Chat por incidente (threads):** mais organizado em volume alto, mas a central opera como uma sala única, e o pedido de prioridade precisa ser visto por todos (inclusive pelo supervisor). Mensagens podem citar um incidente, o que dá o vínculo sem fragmentar a conversa.
- **Permitir que qualquer um "tome" o incidente:** desfaz a garantia de não haver trabalho duplicado.
- **Aceite automático após X minutos sem resposta:** útil, mas cria transferências que o responsável não viu. Fica como evolução, junto com um eventual papel de supervisor.

## Consequências

- O conflito deixa de ser só um aviso privado para quem perdeu a corrida e vira coordenação visível.
- A trilha de auditoria registra quem passou o incidente para quem, e quando.
- O chat não é um sistema de mensagens privadas: tudo é visível para a central, o que é intencional para um ambiente de operação.
