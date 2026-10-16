# ADR-0004: Arquitetura em camadas no backend

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

As regras mais importantes do sistema (ciclo de vida do incidente, quem pode assumir, detecção de conflito) precisam ser fáceis de testar e de explicar. Se ficarem espalhadas entre rotas HTTP e consultas SQL, ficam difíceis de testar isoladamente e de auditar.

## Decisão

O backend segue camadas com dependência em um único sentido:

```
api/           rotas HTTP e schemas Pydantic (contrato de entrada/saída)
  ↓
services/      casos de uso: orquestra regras de domínio e repositórios
  ↓
domain/        regras puras: enums, máquina de estados, criticidade padrão
repositories/  acesso a dados (SQLAlchemy); nenhum SQL fora daqui
models/        mapeamento ORM das tabelas
core/          configuração, banco, segurança e erros (transversal)
```

Padrões aplicados:

- **Repository:** isola o SQL e permite testar serviços sem banco.
- **Service layer:** concentra os casos de uso; as rotas só traduzem HTTP ↔ serviço.
- **DTO:** schemas Pydantic separados dos modelos ORM, para que o contrato da API não vaze a estrutura do banco.
- **Injeção de dependências:** sessão, usuário autenticado e serviços chegam às rotas via `Depends`, substituíveis em testes.
- **Erros de domínio → Problem Details:** serviços lançam exceções de domínio; um handler único as converte em respostas RFC 9457.

## Alternativas consideradas

- **Rotas acessando o ORM diretamente:** menos arquivos, mas regras de negócio misturadas com HTTP e difíceis de testar.
- **Arquitetura hexagonal completa (ports/adapters, interfaces para tudo):** abstrações demais para um único banco e uma única API.

## Consequências

- `domain/` não importa FastAPI nem SQLAlchemy e é testado com testes unitários puros.
- Adicionar um novo canal de entrada (fila, webhook) reutiliza os serviços sem duplicar regras.
- Mais arquivos que um CRUD "tudo na rota", o que é aceitável pelo ganho de clareza.
