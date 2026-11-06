# INVENTÁRIO DE DADOS PESSOAIS — LGPD

Projeto: TeamFlow — Gestão de Equipes  
Empresa: Gestão Tech  
Versão: 1.0  
Data: 06/11/2026

## 1. INTRODUÇÃO

Este documento inventaria todos os dados pessoais tratados pelo sistema TeamFlow, conforme exigido pelo Artigo 20 da LGPD (Registro das Operações de Tratamento — ROPA).

## 2. INVENTÁRIO POR MODELO DE DADOS

### 2.1. Usuários (model: User)

| Campo | Tipo de Dado | Categoria | Finalidade | Base Legal | Retenção |
|-------|-------------|-----------|------------|------------|----------|
| id | Identificador | IDENTIFICAÇÃO | Chave primária do usuário | Legítimo interesse | Ativo |
| name | Nome | IDENTIFICAÇÃO | Identificação do usuário no sistema | Contrato / Consentimento | Ativo + 5 anos após desligamento |
| email | E-mail | CONTATO | Login, comunicações, recuperação de senha | Contrato / Consentimento | Ativo + 5 anos após desligamento |
| passwordHash | Senha (hash) | AUTENTICAÇÃO | Autenticação do usuário | Contrato | Ativo |
| avatarUrl | Imagem | IDENTIFICAÇÃO | Foto de perfil | Consentimento | Ativo |
| phone | Telefone | CONTATO | Contato com o colaborador | Contrato / Consentimento | Ativo |
| createdAt / updatedAt | Timestamp | COMPORTAMENTAL | Auditoria de criação/atualização | Legítimo interesse | Ativo |

### 2.2. Colaboradores / Memberships (model: OrganizationMember)

| Campo | Tipo de Dado | Categoria | Finalidade | Base Legal | Retenção |
|-------|-------------|-----------|------------|------------|----------|
| cpf | CPF | IDENTIFICAÇÃO | Identificação fiscal do colaborador | Obrigação legal | Ativo + período legal (CLT) |
| phone | Telefone | CONTATO | Contato profissional | Contrato | Ativo |
| jobTitle | Cargo | EMPREGO | Identificação da função | Contrato | Ativo |
| departmentId | Departamento | EMPREGO | Vínculo departamental | Contrato | Ativo |
| managerId | Gerente | EMPREGO | Hierarquia organizacional | Contrato | Ativo |
| entryDate | Data de admissão | EMPREGO | Controle de tempo de serviço | Obrigação legal | Ativo + período legal |
| status | Status | EMPREGO | Controle de atividade (ATIVO/INATIVO) | Contrato | Ativo |
| role | Papel | EMPREGO | Controle de acesso (RBAC) | Legítimo interesse | Ativo |

### 2.3. Sessões (model: UserSession)

| Campo | Tipo de Dado | Categoria | Finalidade | Base Legal | Retenção |
|-------|-------------|-----------|------------|------------|----------|
| tokenHash | Hash de sessão | AUTENTICAÇÃO | Validação de sessão (não armazena token) | Legítimo interesse | 30 dias |
| ipAddress | IP | DISPOSITIVO | Auditoria de acesso | Legítimo interesse | 30 dias |
| userAgent | User-agent | DISPOSITIVO | Identificação do navegador | Legítimo interesse | 30 dias |
| browser / device / os | Dispositivo | DISPOSITIVO | Segurança de sessão | Legítimo interesse | 30 dias |
| lastActiveAt | Timestamp | COMPORTAMENTAL | Controle de inatividade | Legítimo interesse | 30 dias |
| expiresAt | Timestamp | AUTENTICAÇÃO | Expiração de sessão | Legítimo interesse | 30 dias |
| revokedAt | Timestamp | AUTENTICAÇÃO | Revogação de sessão | Legítimo interesse | 30 dias |

### 2.4. Autenticação de Dois Fatores (model: UserTwoFactor)

| Campo | Tipo de Dado | Categoria | Finalidade | Base Legal | Retenção |
|-------|-------------|-----------|------------|------------|----------|
| secret | Segredo TOTP | AUTENTICAÇÃO | Geração de códigos 2FA (armazenado criptografado) | Consentimento | Até revogação |
| backupCodes | Códigos backup | AUTENTICAÇÃO | Recuperação de acesso (armazenado criptografado) | Consentimento | Até uso/revogação |

### 2.5. Tokens de Conta (model: AccountToken)

| Campo | Tipo de Dado | Categoria | Finalidade | Base Legal | Retenção |
|-------|-------------|-----------|------------|------------|----------|
| tokenHash | Hash do token | AUTENTICAÇÃO | Primeiro acesso / recuperação de senha | Consentimento | 24 horas (expiração) |
| expiresAt | Validade | AUTENTICAÇÃO | Expiração do token | Consentimento | 24 horas |
| usedAt | Uso | AUTENTICAÇÃO | Controle de uso único | Consentimento | 24 horas |

### 2.6. Atividade / Auditoria (model: ActivityLog)

| Campo | Tipo de Dado | Categoria | Finalidade | Base Legal | Retenção |
|-------|-------------|-----------|------------|------------|----------|
| action | Ação | COMPORTAMENTAL | Registro de operação executada | Legítimo interesse | 2 anos |
| entity / entityId | Entidade | COMPORTAMENTAL | Entidade afetada | Legítimo interesse | 2 anos |
| oldData / newData | Dados | COMPORTAMENTAL | Antes/depois (sanitizado) | Legítimo interesse | 2 anos |
| ipAddress | IP | DISPOSITIVO | Origem da ação (mascarado) | Legítimo interesse | 2 anos |
| userAgent | User-agent | DISPOSITIVO | Navegador utilizado | Legítimo interesse | 2 anos |

### 2.7. Notificações (model: Notification)

| Campo | Tipo de Dado | Categoria | Finalidade | Base Legal | Retenção |
|-------|-------------|-----------|------------|------------|----------|
| title / message | Conteúdo | COMUNICAÇÃO | Notificação ao usuário | Contrato | 1 ano |
| readAt | Leitura | COMPORTAMENTAL | Controle de leitura | Legítimo interesse | 1 ano |

### 2.7. Comentários e Anexos (models: TaskComment, TaskAttachment)

| Campo | Tipo de Dado | Categoria | Finalidade | Base Legal | Retenção |
|-------|-------------|-----------|------------|------------|----------|
| text | Conteúdo | COMPORTAMENTAL | Comentário em tarefa | Contrato | Enquanto a tarefa existir |
| name / url / type | Arquivo | COMPORTAMENTAL | Anexo de tarefa | Contrato | Enquanto a tarefa existir |

### 2.8. Dados de Pagamento (models: Subscription, Invoice)

| Campo | Tipo de Dado | Categoria | Finalidade | Base Legal | Retenção |
|-------|-------------|-----------|------------|------------|----------|
| providerCustomerId | ID externa | FINANCEIRO | Identificação no provedor de pagamento | Contrato | Durante a assinatura + 5 anos |
| amount / currency | Valor | FINANCEIRO | Valor da fatura | Obrigação fiscal | 5 anos |
| status / dueAt / paidAt | Status | FINANCEIRO | Controle de pagamento | Obrigação fiscal | 5 anos |

### 2.9. Chaves de API (model: ApiKey)

| Campo | Tipo de Dado | Categoria | Finalidade | Base Legal | Retenção |
|-------|-------------|-----------|------------|------------|----------|
| keyHash | Hash da chave | AUTENTICAÇÃO | Acesso via API (não armazena chave pura) | Legítimo interesse | Até revogação |
| lastUsedAt | Último uso | COMPORTAMENTAL | Auditoria de uso | Legítimo interesse | Até revogação |

## 3. CAMPOS CRIPTOGRAFADOS

Os seguintes campos são armazenados criptografados (AES-256-GCM):

- `OrganizationMember.cpf`
- `UserTwoFactor.secret`
- `UserTwoFactor.backupCodes`

A chave de criptografia é gerenciada via variável de ambiente `ENCRYPTION_KEY` e nunca é armazenada no banco.

## 4. CAMPOS COM ÍNDICE HMAC (BUSCA SEGURA)

O campo `OrganizationMember.cpf` possui um índice HMAC para busca segura sem descriptografar todos os registros. A chave HMAC é gerenciada via `ENCRYPTION_HMAC_KEY`.

## 5. DESTINATÁRIOS E COMPARTILHAMENTOS

| Destinatário | Dados Compartilhados | Finalidade | Base Legal |
|-------------|---------------------|------------|------------|
| Provedor de e-mail (SMTP) | E-mail, nome | Envio de notificações e tokens de recuperação | Contrato / Consentimento |
| Provedor de pagamento (Asaas) | Dados de assinatura | Processamento de pagamentos | Contrato |
| Hospedagem (Vercel / similar) | Dados da aplicação | Hospedagem da aplicação | Legítimo interesse |
| Banco de dados (PostgreSQL / Neon) | Todos os dados | Armazenamento | Legítimo interesse |

## 6. TRANSFERÊNCIAS INTERNACIONAIS

Dependendo do provedor escolhido, dados podem ser tratados fora do Brasil. Mecanismos legais aplicáveis devem ser verificados caso a caso (cláusulas contratuais padrão, adequação do país, etc.).

## 7. PRAZOS DE RETENÇÃO

| Tipo de Dado | Prazo de Retenção | Justificativa |
|-------------|-------------------|---------------|
| Dados cadastrais ativos | Enquanto o usuário for ativo | Contrato |
| Dados de colaborador desligado | 5 anos após o desligamento | CLT / Obrigação trabalhista |
| Logs de auditoria | 2 anos | LGPD / Segurança |
| Tokens de recuperação | 24 horas | Segurança |
| Sessões inativas | 30 dias | Segurança |
| Faturas / pagamentos | 5 anos | Obrigação fiscal |

## 8. RESPONSÁVEL PELA PROTEÇÃO DE DADOS

O DPO (Data Protection Officer) deve ser designado pela organização. No sistema, o campo `dpoResponsible` em `ProcessingRecord` permite registrar essa informação.

---

## 9. BASES LEGAIS APLICÁVEIS

| Base Legal | Aplicação no Sistema |
|------------|---------------------|
| Consentimento | Cadastro inicial, cookies, marketing |
| Obrigação legal | CPF, registro de ponto, notas fiscais |
| Execução de contrato | Assinatura de planos, termos de uso |
| Legítimo interesse | Segurança, prevenção a fraude, melhoria do produto |
| Exercício regular de direitos | Defesa em processos judiciais |

---