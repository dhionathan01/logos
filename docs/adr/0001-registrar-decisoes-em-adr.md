# ADR-0001: Registrar decisões em ADR

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

O Logos é um MVP de missão crítica construído em pouco tempo. Várias escolhas (controle de concorrência, estratégia de resiliência, deploy) têm trade-offs que não ficam evidentes lendo apenas o código. Quem revisar o projeto precisa entender **por que** cada caminho foi escolhido.

## Decisão

Toda decisão que afete estrutura, contrato da API, integridade de dados, segurança ou operação é registrada em `docs/adr/` antes ou junto do código que a implementa. Pull requests que implementam uma decisão referenciam o ADR correspondente.

## Alternativas consideradas

- **Documentar só no README:** o README envelhece rápido e mistura "como rodar" com "por que é assim".
- **Wiki externa:** separa a decisão do código e do histórico do Git.

## Consequências

- O histórico de decisões é versionado junto com o código.
- Exige disciplina: um ADR curto por decisão, sem virar documentação extensa.
