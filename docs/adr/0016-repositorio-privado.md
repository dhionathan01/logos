# ADR-0016: Repositório privado no GitHub

- **Status:** Aceito (ajusta a configuração do ADR-0011)
- **Data:** 2026-10-17

## Contexto

O ADR-0011 assumia um repositório público: imagens públicas no GHCR e secrets num environment `production`. O repositório foi criado como privado. Isso muda três coisas:

- **Imagens:** pacotes do GHCR publicados a partir de um repositório privado também são privados. Sem autenticação, a VPS não consegue baixá-los.
- **Environments:** no plano gratuito, environments e environment secrets não estão disponíveis em repositórios privados.
- **Minutos de Actions:** repositórios privados no plano gratuito têm cota mensal (2.000 minutos), ao contrário dos públicos.

## Decisão

- O job de deploy pede `packages: read` e entrega o `GITHUB_TOKEN` do próprio job à VPS por stdin para o `docker compose pull`. O token expira ao fim do job e a VPS faz `docker logout` em seguida, então nenhuma credencial de longa duração fica na máquina.
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` e `VPS_KNOWN_HOSTS` passam a ser **secrets do repositório**, e `APP_URL` uma **variable do repositório**. O job não declara mais `environment`.
- O rollback não depende do registry: a versão anterior já está no cache local de imagens da VPS.

## Alternativas consideradas

- **Token pessoal (PAT) gravado na VPS:** permitiria pulls fora do pipeline, mas deixa uma credencial de longa duração na máquina. Desnecessário, porque só o pipeline faz deploy.
- **Tornar só os pacotes públicos:** possível pelas configurações do pacote, mas expõe as imagens de um código que é privado.

## Consequências

- Um pipeline completo usa poucos minutos, folgado para a cota gratuita.
- Para avaliar o código, quem não tem acesso ao repositório precisa ser adicionado como colaborador, ou o repositório precisa ser tornado público na entrega. Nesse caso, a configuração continua funcionando sem mudanças.
