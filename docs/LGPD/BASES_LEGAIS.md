# BASES LEGAIS — LGPD

Projeto: TeamFlow — Gestão de Equipes  
Versão: 1.0  
Data: 06/11/2026

## 1. INTRODUÇÃO

A LGPD prevê 10 bases legais para o tratamento de dados pessoais (Artigo 7º e 11). Este documento documenta quais bases são utilizadas pelo TeamFlow e para quais finalidades.

## 2. BASES LEGAIS UTILIZADAS

### 2.1. Consentimento (Artigo 7º, I)

**Quando se aplica:**
- Cadastro inicial de usuário (opt-in para comunicações)
- Aceite da política de privacidade
- Uso de cookies não essenciais
- Marketing e comunicações promocionais

**Implementação no sistema:**
- Modelo `Consent` registra o aceite do usuário
- Modelo `PrivacyPolicy` armazena versões da política
- Cada consentimento fica vinculado à versão da política aceita
- O usuário pode revogar o consentimento a qualquer momento

**Não se aplica como base universal:** O consentimento não é usado como base legal para tratamentos essenciais ao funcionamento do sistema (ex: autenticação, gestão de folha).

### 2.2. Cumprimento de Obrigação Legal (Artigo 7º, II)

**Quando se aplica:**
- Armazenamento de CPF (obrigação trabalhista/fiscal)
- Emissão de notas fiscais
- Retenção de registros por prazo legal (CLT: 5 anos)

**Implementação no sistema:**
- Modelo `RetentionPolicy` define prazos de retenção por obrigação legal
- Campo `legalBasis` em `ProcessingRecord` documenta a base

### 2.3. Execução de Contrato (Artigo 7º, V)

**Quando se aplica:**
- Assinatura de planos de assinatura
- Fornecimento da plataforma SaaS
- Gestão de colaboradores dentro da organização

**Implementação no sistema:**
- Modelo `Subscription` gerencia contratos de assinatura
- Modelo `OrganizationMember` gerencia vínculos contratuais

### 2.4. Interesse Legítimo (Artigo 7º, IX)

**Quando se aplica:**
- Segurança da informação e prevenção a fraudes
- Melhoria contínua do produto com base no uso
- Análises internas de produtividade (sem identificar indivíduos)

**Implementação no sistema:**
- Logs de auditoria (`ActivityLog`) para segurança
- Métricas agregadas (não identificáveis)

### 2.5. Exercício Regular de Direitos (Artigo 7º, VI)

**Quando se aplica:**
- Defesa da organização em processos judiciais ou administrativos
- Exercício de direitos contratuais

## 3. MATRIZ DE BASES LEGAIS POR OPERAÇÃO

| Operação | Dados | Base Legal | Justificativa |
|----------|-------|------------|---------------|
| Cadastro de usuário | Nome, e-mail, senha | Consentimento + Contrato | Usuário concorda e é necessário para o serviço |
| Login | E-mail, senha | Contrato | Necessário para autenticação |
| Armazenar CPF | CPF | Obrigação legal | Exigido pela legislação trabalhista |
| Logs de auditoria | Ações, IP, user-agent | Legítimo interesse | Segurança e rastreabilidade |
| Envio de e-mail | E-mail, nome | Consentimento | Usuário optou por receber |
| Cobrança por assinatura | Dados de pagamento | Execução de contrato | Necessário para o serviço |
| 2FA | Segredo TOTP | Consentimento | Usuário opta por ativar |

## 4. REGISTRO DE BASES LEGAIS

Cada `ProcessingRecord` no sistema deve especificar a base legal aplicável. O campo `legalBasis` utiliza o enum:

- `CONSENT`
- `LEGAL_OBLIGATION`
- `PUBLIC_POLICY`
- `CONTRACT`
- `LEGITIMATE_INTEREST`
- `VITAL_INTEREST`
- `LEGAL_EXERCISE`
- `OTHER`

## 5. REVOGAÇÃO DO CONSENTIMENTO

Quando o consentimento é a base legal, o titular pode revogá-lo a qualquer momento. O sistema permite:
- Revogação via interface (página de consentimento)
- Registro da revogação no modelo `Consent` (campo `revokedAt`)
- Interrupção do tratamento baseado exclusivamente em consentimento

---

**Nota:** A definição da base legal apropriada para cada operação específica é de responsabilidade jurídica da organização. Este documento registra as bases implementadas tecnicamente, mas não substitui a análise jurídica caso a caso.