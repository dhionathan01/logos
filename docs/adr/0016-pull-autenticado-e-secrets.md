# ADR-0016: Pull autenticado do GHCR e secrets no nível do repositório

- **Status:** Aceito (ajusta a configuração do ADR-0011)
- **Data:** 2026-10-17

## Contexto

O ADR-0011 assumia que as imagens no GHCR seriam públicas e guardava os secrets num environment `production`. Durante a configuração, o repositório chegou a ser criado como privado e depois foi tornado público. Isso expôs duas premissas frágeis:

- **Visibilidade das imagens:** um pacote do GHCR pode nascer privado, por exemplo se o repositório era privado no primeiro push ou pela configuração padrão da conta. Mudar o repositório para público não muda a visibilidade do pacote. Se o deploy depender de imagens públicas, ele quebra de forma silenciosa.
- **Environments:** no plano gratuito, environments só existem em repositórios públicos. Uma mudança de visibilidade não deveria quebrar o pipeline.

## Decisão

- O job de deploy pede `packages: read` e entrega o `GITHUB_TOKEN` do próprio job à VPS por stdin para o `docker compose pull`. O token expira ao fim do job e a VPS faz `docker logout` em seguida, então nenhuma credencial de longa duração fica na máquina. Funciona com o pacote público ou privado.
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` e `VPS_KNOWN_HOSTS` são **secrets do repositório**, e `APP_URL` uma **variable do repositório**. O job não declara `environment`.
- O rollback não depende do registry: a versão anterior já está no cache local de imagens da VPS.

## Alternativas consideradas

- **Token pessoal (PAT) gravado na VPS:** permitiria pulls fora do pipeline, mas deixa uma credencial de longa duração na máquina. Desnecessário, porque só o pipeline faz deploy.
- **Exigir imagens públicas:** é mais simples, mas depende de uma configuração manual do pacote que ninguém lembra de checar.

## Consequências

- O pipeline independe da visibilidade do repositório e dos pacotes.
- Sem `environment`, perde-se o link da URL publicada na tela do job. O smoke test continua validando a URL pública ao fim de cada deploy.
