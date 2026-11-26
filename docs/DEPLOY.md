# Checklist de operação e deploy

## Situação verificada em 26/11/2026

- Produção atual: commit `76d4a05` (deploy Vercel `READY`).
- Foi identificada falha de runtime no Prisma: `DATABASE_URL` inválida no ambiente de produção.
- Banco Neon de produção: migrations listadas como concluídas; coluna CPF em texto puro ausente.
- A migration `20261112140000_drop_plain_cpf` está aplicada.
- A migration `20261122100000_organization_asaas_customer` está aplicada e agora está versionada no repositório.
- O cadastro de usuários ainda precisa ser validado após corrigir a conexão do banco.
- Asaas/checkout estão adiados; não configurar webhook nem reativar cobrança até nova decisão comercial.

## 1. Configurações obrigatórias para operação

- [ ] Corrigir `DATABASE_URL` em Vercel → Settings → Environment Variables → Production. Copiar a connection string **pooled** da branch `production` no Neon; preservar o segredo e não o enviar por chat.
- [ ] Configurar `CRON_SECRET` no Vercel. O cron diário `/api/cron/retention` está definido em `vercel.json` para 03:00 UTC e responde 503 sem essa variável.
- [ ] Para recuperação de senha por e-mail, configurar `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM`. Sem SMTP, o sistema informa indisponibilidade em vez de simular envio.
- [ ] Para previews funcionais, configurar `DATABASE_URL` apontando para uma branch Neon exclusiva de preview e `AUTH_SECRET` próprio. Nunca usar a base de produção nos previews; atualmente essas duas variáveis não estão configuradas no target Preview.
- [ ] Confirmar `AUTH_SECRET`, `ENCRYPTION_KEY`, `ENCRYPTION_HMAC_KEY`, `NEXT_PUBLIC_APP_URL` e `PUBLIC_APP_URL` sem alterar chaves de criptografia sem plano de rotação.

## 2. Banco de dados

- [x] `20261112140000_drop_plain_cpf` aplicada.
- [x] `20261122100000_organization_asaas_customer` aplicada.
- [ ] Após corrigir `DATABASE_URL`, executar `prisma migrate status` com conexão direta para confirmar que não há drift ou migration pendente.
- [ ] Não excluir as seis organizações sem membros encontradas na base sem confirmar se são dados de teste ou dados que precisam ser recuperados.

## 3. Validação funcional obrigatória após corrigir o banco

- [ ] Criar uma conta nova, concluir criação da organização e validar login/logout.
- [ ] Testar 2FA, códigos de backup e revogação de sessões.
- [ ] Criar, editar, convidar e remover colaboradores com cada papel (OWNER, ADMIN, MANAGER, LEADER e MEMBER).
- [ ] Testar equipes, departamentos, projetos, tarefas, metas, agenda, avisos e notificações.
- [ ] Verificar persistência de cada operação após atualizar a página e entrar novamente.
- [ ] Testar isolamento entre organizações e escopo por equipe.
- [ ] Testar exportação, consentimento, políticas de privacidade, registros de tratamento, incidentes e retenção.
- [ ] Validar os links de contratação via WhatsApp na página pública.
- [ ] Não testar checkout Asaas até a integração ser reativada formalmente.

## 4. CI e Vercel

- O build agora executa ESLint e TypeScript; os erros não são mais ignorados.
- O workflow GitHub Actions executa lint, typecheck, testes unitários e build.
- O PR de auditoria deve permanecer aberto até CI e preview da versão final estarem aprovados e a variável de banco ser corrigida.
- Não promover para produção antes de testar os fluxos autenticados com uma conta real.

## Observações

- O rate limiting do middleware é em memória por instância e não é distribuído entre todas as instâncias serverless.
- A validação técnica não substitui revisão jurídica e operacional de LGPD; consulte `docs/LGPD/PENDENCIAS_E_OPERACAO.md`.
