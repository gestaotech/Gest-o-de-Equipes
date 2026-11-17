# Variáveis de ambiente

Guia das variáveis usadas pelo TeamFlow. Valores reais devem ficar só no `.env` local (ignorado pelo git) ou nas variáveis de ambiente do Vercel. Nunca commite segredos.

## Obrigatórias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL. No Neon, use a URL com SSL (`sslmode=require`). Para comandos de migration (`prisma migrate`), prefira a URL direta (sem `-pooler`); a aplicação pode usar o pooler. |
| `AUTH_SECRET` | Chave para assinar os JWTs de sessão. Gere uma string aleatória com 32+ caracteres. |
| `ENCRYPTION_KEY` | Chave mestra da criptografia AES-256-GCM (CPF e segredos de 2FA). Mínimo 32 caracteres. |
| `ENCRYPTION_HMAC_KEY` | Chave independente para o índice HMAC de busca por CPF. Mínimo 32 caracteres e diferente de `ENCRYPTION_KEY`. |

## URLs públicas

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_APP_URL` | URL base pública do app (layout/metadata). Ex.: `https://seu-dominio.vercel.app`. |
| `PUBLIC_APP_URL` | URL usada nos links de e-mail (primeiro acesso e redefinição de senha). Hoje o código lê esta variável; use o mesmo valor de `NEXT_PUBLIC_APP_URL`. |

## Billing (Asaas)

| Variável | Descrição |
|---|---|
| `ASAAS_API_KEY` | Chave da API Asaas. Hoje nenhum módulo a utiliza: a cobrança foi removida e precisa ser reimplementada antes de ser necessária. |
| `ASAAS_ENVIRONMENT` | `sandbox` (padrão) ou `production`. Em produção, defina `production`; sem isso a integração usa a API de sandbox. |
| `ASAAS_WEBHOOK_TOKEN` | Token de autenticação do webhook, enviado pela Asaas no header `asaas-access-token`. Obrigatório para `POST /api/webhooks/asaas` (sem ele o endpoint responde 503). Configure o mesmo valor no painel de webhooks da Asaas. |

## Cron e retenção

| Variável | Descrição |
|---|---|
| `CRON_SECRET` | Segredo usado pelo Vercel Cron. O endpoint `GET /api/cron/retention` exige `Authorization: Bearer <CRON_SECRET>`. No Vercel, defina a variável e o cron (já declarado em `vercel.json`, diário às 03:00 UTC) enviará o header automaticamente. Sem ela o endpoint responde 503. |

## E-mail

| Variável | Descrição |
|---|---|
| `EMAIL_PROVIDER` | `smtp`, `console` (padrão em desenvolvimento) ou `none` (padrão em produção sem configuração). |
| `SMTP_HOST` | Servidor SMTP. |
| `SMTP_PORT` | Porta SMTP (padrão 587; 465 usa conexão segura). |
| `SMTP_USER` | Usuário SMTP. |
| `SMTP_PASSWORD` | Senha SMTP. |
| `SMTP_FROM` | Remetente (padrão `nao-responda@teamflow.local`). |

Com `EMAIL_PROVIDER=none`, os e-mails de primeiro acesso e redefinição de senha não são enviados. Em desenvolvimento, `console` registra o conteúdo no log.

## Ordem de deploy (webhook e retenção)

1. Aplicar as migrations pendentes no banco antes do deploy que depende delas.
2. Configurar no Vercel: `ASAAS_WEBHOOK_TOKEN`, `ASAAS_ENVIRONMENT=production`, `CRON_SECRET` e as chaves de criptografia.
3. Fazer o deploy.
4. Cadastrar o webhook na Asaas para `https://<domínio>/api/webhooks/asaas` com o mesmo `ASAAS_WEBHOOK_TOKEN`.

## Observações

- **Rate limiting:** o middleware aplica limites em memória por instância. Em ambiente serverless com várias instâncias, o limite não é compartilhado entre elas. Para limite distribuído, é necessário um armazenamento compartilhado (ex.: Redis/Upstash). A tabela `rate_limit_records` existe no banco, mas não é usada pelo middleware atual.
- **`ASAAS_ENVIRONMENT`:** o padrão é `sandbox`. Em produção, defina explicitamente `production`.
- **Rotação de segredos:** se uma chave ou token for exposta, gere um novo valor, atualize o ambiente e revogue o anterior no provedor correspondente.
