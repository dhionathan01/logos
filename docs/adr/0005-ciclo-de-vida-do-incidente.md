# ADR-0005: Ciclo de vida do incidente como máquina de estados

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

O enunciado define quatro status (Aberto, Em Investigação, Inconclusivo, Fechado), mas não diz quais mudanças são válidas. Sem regra explícita, um incidente poderia ser fechado sem que ninguém o investigasse, ou reaberto depois de encerrado, o que torna o histórico operacional pouco confiável.

## Decisão

As transições permitidas ficam em uma tabela única em `app/domain/incident.py`:

| De \ Para | Aberto | Em Investigação | Inconclusivo | Fechado |
|---|---|---|---|---|
| **Aberto** | | ✔ (assume) | | |
| **Em Investigação** | ✔ (devolve) | | ✔ | ✔ |
| **Inconclusivo** | | ✔ (retoma) | | ✔ |
| **Fechado** | | | | |

- Entrar em **Em Investigação** atribui o incidente ao analista que fez a mudança.
- Enquanto um incidente está **Em Investigação**, só o responsável pode alterá-lo (ver ADR-0007).
- **Fechado** é terminal: um novo problema no mesmo local gera um novo incidente.
- **Criticidade padrão por categoria:** quando a ingestão não informa criticidade, ela é derivada da categoria (Acidente com Vítimas → Alta, Problema Mecânico → Baixa etc.). O analista pode ajustá-la depois.

A tabela é implementada como dicionário, e não com o padrão State do GoF (uma classe por estado): com quatro estados sem comportamento próprio, classes adicionariam indireção sem benefício.

## Alternativas consideradas

- **Qualquer status para qualquer status:** mais simples, mas permite fechar incidentes sem investigação.
- **Padrão State com classes:** útil quando cada estado tem comportamento rico; não é o caso.

## Consequências

- As regras de negócio são testadas unitariamente, sem banco.
- O frontend mostra apenas as ações válidas para o status atual, e a API rejeita as demais com `409 invalid-transition`.
- Mudar o fluxo exige alterar uma tabela e seus testes, nada mais.
