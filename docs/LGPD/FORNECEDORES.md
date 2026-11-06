# FORNECEDORES E INTEGRAÇÕES — LGPD

Projeto: TeamFlow — Gestão de Equipes  
Versão: 1.0  
Data: 06/11/2026

## 1. MAPEAMENTO DE FORNECEDORES

O sistema utiliza os seguintes fornecedores e serviços externos:

| Fornecedor | Serviço | Dados Compartilhados | Local | Responsabilidade |
|------------|---------|---------------------|-------|------------------|
| Vercel / Próprio servidor | Hospedagem da aplicação | Dados da aplicação | Depende do plano | Disponibilidade |
| PostgreSQL / Neon | Banco de dados | Todos os dados do sistema | Depende do provedor | Integridade dos dados |
| SMTP (configurável) | Envio de e-mail | E-mail, nome, tokens de recuperação | Depende do provedor | Entrega de mensagens |
| Asaas | Processamento de pagamentos | Dados de assinatura, faturas | Brasil | Processamento de pagamento |
| Google / Outros | Integrações opcionais | Dados configurados pela organização | Depende da integração | Conforme integração |

## 2. MODELO Integration

O modelo `Integration` permite cadastrar fornecedores utilizados pela organização:

| Campo | Descrição |
|-------|-----------|
| provider | Nome do provedor (ex: "smtp", "asaas", "google") |
| config | Configuração (JSON, sem segredos em texto puro) |
| enabled | Se a integração está ativa |
| createdById | Quem cadastrou |
| organizationId | Organização proprietária |

## 3. MODELO ApiKey

Chaves de API para integrações externas:

- `keyHash`: Hash da chave (não armazena a chave pura)
- `lastUsedAt`: Último uso
- `revokedAt`: Revogação

## 4. REGRAS DE SEGURANÇA PARA INTEGRAÇÕES

- ✅ Chaves de API são armazenadas como hash, não em texto puro
- ✅ Configurações de integração não devem conter segredos em texto puro
- ✅ Segredos nunca são retornados ao frontend
- ✅ Webhooks possuem verificação de assinatura (SHA-256)
- ✅ Cada integração fica vinculada à organização

## 5. TRANSFERÊNCIAS INTERNACIONAIS

Dependendo do provedor escolhido, dados podem ser tratados fora do Brasil. A organização deve:

- Verificar se o país de destino possui nível adequado de proteção
- Utilizar cláusulas contratuais padrão quando necessário
- Documentar a transferência no `ProcessingRecord` (campo `sharedWith`)

## 6. RESPONSABILIDADE CONTRATUAL

Cada organização é responsável por:
- Revisar os termos de uso de seus fornecedores
- Garantir que os fornecedores cumpram a LGPD
- Documentar compartilhamentos no ROPA (`ProcessingRecord`)

---