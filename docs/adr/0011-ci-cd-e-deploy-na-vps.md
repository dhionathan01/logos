# ADR-0011: CI/CD com GitHub Actions e deploy em Docker na VPS Oracle

- **Status:** Aceito
- **Data:** 2026-10-16

## Contexto

A aplicação precisa estar online para avaliação. O ambiente disponível é uma VM da Oracle Cloud (x86_64, 2 vCPU, **1 GB de RAM, sem swap**) que já serve outro site pelo nginx na porta 80, e que não pode ser afetado. Queremos que todo merge na `main` passe por testes e chegue à produção sem passos manuais, com como voltar atrás se algo der errado.

## Decisão

**Fluxo:**

```
PR ──► Backend CI + Frontend CI (lint, tipos, testes, contrato OpenAPI, build)
         └─ revisão do PR (template com checklist) ──► merge na main
main ──► mesmos CIs ──► build das imagens api/web ──► push no GHCR (tag = SHA do commit)
     ──► SSH na VPS ──► deploy.sh: pull + up -d ──► health check ──► rollback automático se falhar
     ──► smoke test na URL pública
```

**Decisões que sustentam o fluxo:**
- **Imagens construídas no GitHub, não na VPS.** Compilar Node e Python numa VM de 1 GB a deixaria sem memória e derrubaria o site vizinho. A VPS só faz `docker pull`.
- **Tag imutável por commit (SHA).** O `.env` da VPS guarda a tag em uso; rollback é voltar a tag anterior. `latest` existe só por conveniência.
- **Rollback automático:** `deploy.sh` espera até 90 s por `/api/health/ready` (API **e** banco respondendo); se não ficar saudável, restaura a tag anterior e o job falha.
- **Isolamento do site existente:** a stack roda em Docker Compose com só a porta do `web` publicada em `127.0.0.1:8080`. O nginx do host ganha um server block **próprio** para o subdomínio e termina o TLS (Let's Encrypt).
- **Memória:** 2 GB de swap, PostgreSQL ajustado (`shared_buffers=64MB`, 30 conexões) e `mem_limit` por container. A stack medida localmente usa cerca de 105 MB.
- **Menor privilégio no pipeline:** usuário `deploy` dedicado, sem sudo, com chave SSH própria (não a chave pessoal de administração). A host key da VPS é fixada em `VPS_KNOWN_HOSTS`, sem "trust on first use". O token do GHCR é passado por stdin e descartado ao fim.
- **Segredos** (senha do banco, segredo JWT, chave de ingestão) são gerados na própria VPS pelo bootstrap e nunca passam pelo GitHub nem pelo repositório.
- **Migrações** rodam no entrypoint da API antes do servidor subir; são aditivas e foram testadas com downgrade/upgrade no CI.

**Configuração necessária no GitHub** (environment `production`):

| Tipo | Nome | Conteúdo |
|---|---|---|
| Secret | `VPS_HOST` | IP da VPS |
| Secret | `VPS_USER` | `deploy` |
| Secret | `VPS_SSH_KEY` | chave privada do par de deploy |
| Secret | `VPS_KNOWN_HOSTS` | saída de `ssh-keyscan <ip>` |
| Variable | `APP_URL` | URL pública, ex.: `https://logos-autou.duckdns.org` |

## Alternativas consideradas

- **PaaS (Render, Railway, Vercel + backend separado):** menos trabalho de operação, mas planos gratuitos hibernam (primeiro acesso lento na avaliação) e não exercitariam o pipeline próprio pedido.
- **Kubernetes (k3s):** overhead de memória incompatível com 1 GB.
- **Build na VPS via `git pull`:** simples, mas sem artefato versionado para rollback e com risco de esgotar a memória.
- **Watchtower (auto-update por polling do registry):** tira do pipeline o controle de quando o deploy acontece e de verificar se deu certo.

## Consequências

- Todo deploy é rastreável a um commit, e uma versão quebrada não fica no ar.
- O usuário `deploy` está no grupo `docker`, o que na prática equivale a root na VM. É aceitável para um MVP numa VM dedicada; o endurecimento seria Docker rootless ou um comando SSH forçado (`command=` no `authorized_keys`) que só execute o `deploy.sh`.
- Há uma janela de poucos segundos de indisponibilidade durante o `up -d` (sem blue/green); aceitável para o MVP.
- **Custo: zero.** GitHub Actions e GHCR são gratuitos para repositório público, e a VM é do plano Always Free da OCI.
