# SEGURANÇA — LGPD

Projeto: TeamFlow — Gestão de Equipes  
Versão: 1.0  
Data: 06/11/2026

## 1. CRIPTOGRAFIA

### 1.1. Algoritmo Utilizado

- **AES-256-GCM**: Criptografia simétrica autenticada para dados pessoais sensíveis
- **SHA-256**: Hash para tokens de conta e verificação de integridade
- **scrypt**: Derivação de chaves a partir da senha mestra
- **HMAC-SHA256**: Índice de busca para CPF (permite busca sem descriptografar)

### 1.2. Campos Criptografados

| Campo | Modelo | Localização |
|-------|--------|-------------|
| cpf | OrganizationMember | Banco de dados (criptografado) |
| secret | UserTwoFactor | Banco de dados (criptografado) |
| backupCodes | UserTwoFactor | Banco de dados (criptografado) |

### 1.3. Gerenciamento de Chaves

- `ENCRYPTION_KEY`: Chave mestra para criptografia AES-256-GCM
- `ENCRYPTION_HMAC_KEY`: Chave independente para HMAC de busca
- Chaves NUNCA são armazenadas no banco de dados
- Chaves NUNCA são incluídas no código ou no repositório
- Chaves devem ser configuradas via variáveis de ambiente

### 1.4. Versionamento e Rotação

- Todos os dados criptografados incluem prefixo de versão (`tf:enc:v1:`)
- Permite rotação de chaves no futuro sem perda de dados
- Processo de rotação: descriptografar com chave antiga, criptografar com nova

## 2. AUTENTICAÇÃO E SESSÕES

### 2.1. Sessões

- JWT assinado (HS256) em cookie httpOnly
- Cookie `tf_session`: httpOnly, secure, sameSite=lax, 30 dias
- Cookie `tf_org`: Organização ativa selecionada pelo usuário
- Sessão armazenada no banco (hash do token, não o token)
- Revogação de sessões em mudança de senha ou logout

### 2.2. Senhas

- Hash com bcrypt (custo 12)
- Mínimo 6 caracteres, máximo 72
- Recuperação via token de 24 horas (uso único)
- Primeira acesso via token de ativação

### 2.3. Autenticação de Dois Fatores (2FA)

- TOTP (Time-based One-Time Password)
- Segredo base32 armazenado criptografado
- Códigos de backup (8 códigos de uso único)
- Verificação de senha atual para desativar 2FA

### 2.4. Proteção Contra Abuso

- Rate limiting: 10 requisições por minuto por IP em rotas de autenticação
- Middleware Next.js com rate limiting em login, cadastro, recuperar senha
- Sessões revogadas em troca de senha

## 3. CONTROLE DE ACESSO

### 3.1. RBAC (Role-Based Access Control)

| Papel | Escopo | Descrição |
|-------|--------|-----------|
| OWNER | ORG | Acesso total |
| ADMIN | ORG | Acesso administrativo completo |
| MANAGER | ORG | Gerenciamento de equipes, departamentos, projetos |
| LEADER | LEAD | Acesso a equipes que lidera |
| MEMBER | SELF | Acesso apenas a próprios dados |

### 3.2. Data Scope

- `organizationId` sempre derivado da sessão ativa (nunca do cliente)
- Filtros de visibilidade por nível (ORG/LEAD/SELF)
- Predicados `canAccess*` para recursos únicos
- Proteção contra IDOR (Insecure Direct Object Reference)

### 3.3. Isolamento Multiempresa

- Cada modelo referencia `organizationId`
- Consultas sempre filtram por `organizationId` da sessão ativa
- Validação de referências entre organizações bloqueada
- Testes de isolamento entre organizações implementados

## 4. LOGS DE AUDITORIA

### 4.1. Sanitização

O módulo `audit-sanitizer.ts` garante que:

- ✅ Senhas nunca são armazenadas
- ✅ Tokens nunca são armazenados
- ✅ CPF é mascarado (não texto puro)
- ✅ E-mail é mascarado (primeira letra + domínio)
- ✅ Telefone é mascarado (DDD + últimos 4 dígitos)
- ✅ Chaves de API são redigidas
- ✅ Segredos de integração são redigidos

### 4.2. Campos Registrados

- Usuário responsável (userId)
- Organização (organizationId)
- Ação executada (action)
- Entidade afetada (entity/entityId)
- Data e hora (createdAt)
- Resultado da operação
- IP mascarado e user-agent

## 5. VARIÁVEIS DE AMBIENTE DE SEGURANÇA

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| AUTH_SECRET | Sim | Chave para assinatura JWT |
| ENCRYPTION_KEY | Sim | Chave mestra para criptografia AES-256-GCM |
| ENCRYPTION_HMAC_KEY | Sim | Chave para HMAC de busca por CPF |
| ASAAS_API_KEY | Sim (build) | Chave da API Asaas (billing) |
| DATABASE_URL | Sim | Conexão PostgreSQL |

---