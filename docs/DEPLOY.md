# Checklist de deploy

Branch atual: `fix/lgpd-security-and-compliance` (commits locais, sem push).

## 1. Antes do deploy

- [ ] **Segredos expostos:** a chave da Asaas e a senha do banco foram expostas no chat/arquivos locais. Rotacione-as no provedor e atualize os ambientes. Não reutilize valores expostos.
- [ ] **Variáveis no Vercel:** conferir `docs/VARIAVEIS_AMBIENTE.md`. Obrigatórias para esta versão: `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `ENCRYPTION_HMAC_KEY`, `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT=production`, `ASAAS_WEBHOOK_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `PUBLIC_APP_URL`.
- [ ] **Banco:** o banco de produção já está alinhado ao schema e com as migrations registradas, **exceto** `20261112140000_drop_plain_cpf` (pendente). Não aplique `drop_plain_cpf` antes do deploy do código que para de gravar `cpf`.

## 2. Publicar

- [ ] Fazer push do branch e abrir/atualizar o deploy no Vercel.
- [ ] Aguardar o deploy concluir com sucesso.

## 3. Após o deploy

- [ ] **Migration `drop_plain_cpf`:** aplicar em produção (via conexão direta, preferencialmente). A migration aborta se houver CPF em texto puro sem versão criptografada.
  - Exemplo: `npx prisma migrate deploy` (com `DATABASE_URL` apontando para produção) ou execução controlada do SQL da migration.
  - Confirmar: `npx prisma migrate status` deve indicar banco em dia.
- [ ] **Webhook Asaas:** cadastrar/atualizar para `https://<domínio>/api/webhooks/asaas` com o mesmo valor de `ASAAS_WEBHOOK_TOKEN` no header `asaas-access-token`. Testar um evento e conferir resposta 200.
- [ ] **Cron de retenção:** confirmar que `CRON_SECRET` está configurado no Vercel e que o cron de `vercel.json` (`/api/cron/retention`, 03:00 UTC) aparece no projeto.

## 4. Validação pós-deploy

- [ ] Login e navegação básicos.
- [ ] Fluxo de login com 2FA (ativar em Perfil → Segurança, sair e entrar).
- [ ] Criar/exportar solicitação LGPD e baixar exportação de dados.
- [ ] Criar política de retenção suportada e verificar execução do cron (logs/resultado do endpoint).
- [ ] Assinatura/checkout Asaas e recebimento de webhook (status da assinatura atualizado).

## Observações

- `ASAAS_ENVIRONMENT` tem padrão `sandbox`; em produção deve ser `production`.
- O rate limiting do middleware é em memória por instância (não distribuído).
- Não declare conformidade integral com a LGPD apenas com a implementação técnica; ver `docs/LGPD/PENDENCIAS_E_OPERACAO.md`.
