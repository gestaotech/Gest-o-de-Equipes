# Variáveis de ambiente

Guia das variáveis usadas pelo TeamFlow. Valores reais devem ficar só no `.env` local (ignorado pelo git) ou nas variáveis de ambiente do Vercel. Nunca commite segredos.

## Obrigatórias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL usada pela aplicação. No Neon/Vercel, use a connection string pooled da branch `production` (host com `-pooler`) e SSL (`sslmode=require`). O valor atual de produção precisa ser corrigido antes de liberar o sistema. Para migrations, use conexão direta (sem `-pooler`) ao executar os comandos manualmente. |
| `AUTH_SECRET` | Chave para assinar os JWTs de sessão. Gere uma string aleatória com 32+ caracteres. |
| `ENCRYPTION_KEY` | Chave mestra da criptografia AES-256-GCM (CPF e segredos de 2FA). Mínimo 32 caracteres. |
| `ENCRYPTION_HMAC_KEY` | Chave independente para o índice HMAC de busca por CPF. Mínimo 32 caracteres e diferente de `ENCRYPTION_KEY`. |

## URLs públicas

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_APP_URL` | URL base pública do app (layout/metadata). Ex.: `https://seu-dominio.vercel.app`. |
| `PUBLIC_APP_URL` | URL base usada nos links de recuperação de senha por e-mail; use o mesmo valor de `NEXT_PUBLIC_APP_URL`. O primeiro acesso de colaboradores é entregue como link de uso único para o administrador copiar e encaminhar. |

## Billing (Asaas) — adiado

| Variável | Descrição |
|---|---|
| `ASAAS_API_KEY` | Chave da API Asaas. Integração adiada; não habilitar até revisão e reimplementação do fluxo de cobrança. |
| `ASAAS_ENVIRONMENT` | Mantida para uso futuro. Não é necessária para o fluxo atual de contratação via WhatsApp. |
| `ASAAS_WEBHOOK_TOKEN` | Mantida para uso futuro. Não cadastrar webhook enquanto a integração estiver adiada. |

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

Com `EMAIL_PROVIDER=none`, a recuperação de senha informa indisponibilidade; não simula envio. O link de primeiro acesso é disponibilizado ao administrador na tela de colaboradores para encaminhamento seguro. Em desenvolvimento, `console` registra o conteúdo no log.

## Ordem de deploy

1. Configurar no Vercel `DATABASE_URL`, `CRON_SECRET` e as chaves de autenticação/criptografia.
2. Configurar SMTP se a recuperação de senha por e-mail for necessária.
3. Fazer o deploy e validar login, cadastro e persistência.
4. Manter webhook Asaas desativado até reativação formal da integração.

## Observações

- **Rate limiting:** o middleware aplica limites em memória por instância. Em ambiente serverless com várias instâncias, o limite não é compartilhado entre elas. Para limite distribuído, é necessário um armazenamento compartilhado (ex.: Redis/Upstash). A tabela `rate_limit_records` existe no banco, mas não é usada pelo middleware atual.
- **`ASAAS_ENVIRONMENT`:** o padrão é `sandbox`. Em produção, defina explicitamente `production`.
- **Rotação de segredos:** se uma chave ou token for exposta, gere um novo valor, atualize o ambiente e revogue o anterior no provedor correspondente.
