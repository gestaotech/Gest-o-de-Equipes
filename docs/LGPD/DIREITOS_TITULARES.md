# DIREITOS DOS TITULARES — LGPD

Projeto: TeamFlow — Gestão de Equipes  
Versão: 1.0  
Data: 06/11/2026

## 1. INTRODUÇÃO

A LGPD (Artigo 18) garante aos titulares de dados pessoais o direito de solicitar:
- Confirmação da existência de tratamento
- Acesso aos dados
- Correção de dados incompletos, inexatos ou desatualizados
- Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade
- Portabilidade dos dados a outro fornecedor
- Eliminação dos dados pessoais tratados com o consentimento do titular
- Informação das entidades públicas e privadas com as quais o controlador compartilhou dados
- Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa
- Revogação do consentimento

## 2. MODELO LGPDRequest

O sistema implementa o modelo `LGPDRequest` para registrar e acompanhar solicitações de titulares:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| type | Enum | ACCESS, CORRECTION, ANONYMIZATION, PORTABILITY, DELETION, REVOCATION, OPPOSITION, OTHER |
| status | Enum | PENDING, IN_PROGRESS, COMPLETED, REJECTED, CANCELLED |
| description | String | Detalhes da solicitação |
| legalBasis | String | Base legal aplicável |
| responseDeadline | DateTime | Prazo legal (15 dias úteis) |
| completedAt | DateTime | Data de conclusão |
| rejectionReason | String | Justificativa de recusa |
| handledById | String | Responsável pelo atendimento |
| history | LGPDRequestHistory[] | Histórico de mudanças de status |

## 3. FLUXO DE ATENDIMENTO

### 3.1. Abertura da Solicitação

Qualquer usuário pode abrir uma solicitação sobre seus próprios dados. Administradores (OWNER, ADMIN, MANAGER com audit.read) podem abrir solicitações em nome de outros titulares da mesma organização.

### 3.2. Validação de Identidade

Antes de liberar dados pessoais, a identidade do solicitante deve ser verificada. O sistema não implementa verificação automática de identidade; isso deve ser feito por processo manual da organização.

### 3.3. Atendimento

O responsável pelo atendimento:
1. Revisa a solicitação
2. Define o status (IN_PROGRESS)
3. Executa a ação solicitada (acesso, correção, eliminação, etc.)
4. Define o status final (COMPLETED ou REJECTED com justificativa)
5. Registra o histórico de mudanças

### 3.4. Prazo

O prazo legal para atendimento é de 15 dias úteis (LGPD Artigo 19, §1º). O sistema calcula automaticamente a `responseDeadline` como 15 dias a partir da criação.

## 4. OPERAÇÕES DISPONÍVEIS

### 4.1. Acesso aos Dados

O titular pode solicitar uma cópia de seus dados pessoais. O sistema exporta os dados em formato JSON incluindo:
- Dados cadastrais (nome, e-mail, telefone)
- Vínculo com a organização
- Sessões de autenticação (IP mascarado)
- Notificações recebidas
- Comentários em tarefas
- Registros de atividade

### 4.2. Correção de Dados

O titular pode solicitar correção de dados incorretos. A correção deve ser feita pelo administrador da organização, mantendo histórico de auditoria.

### 4.3. Eliminação de Dados

A eliminação é permitida quando:
- Não há obrigação legal de retenção
- O titular não é a última OWNER da organização
- Não há dependências que impeçam a exclusão

### 4.4. Anonimização

Quando a eliminação não é possível (ex: dados necessários para auditoria), os dados são anonimizados (substituídos por valores não identificadores).

### 4.5. Portabilidade

Os dados podem ser exportados em formato JSON estruturado para transferência a outro fornecedor.

### 4.6. Revogação de Consentimento

Quando o consentimento é a base legal, o titular pode revogá-lo a qualquer momento.

## 5. STATUS DA SOLICITAÇÃO

| Status | Descrição |
|--------|-----------|
| PENDING | Recebida, aguardando análise |
| IN_PROGRESS | Em análise/atendimento |
| COMPLETED | Atendida com sucesso |
| REJECTED | Rejeitada (com justificativa) |
| CANCELLED | Cancelada pelo titular |

## 6. ACESSO POR PERFIL

| Perfil | Acesso |
|--------|--------|
| MEMBER | Apenas suas próprias solicitações |
| LEADER | Apenas suas próprias solicitações |
| MANAGER | Todas da organização (se tiver audit.read) |
| ADMIN | Todas da organização |
| OWNER | Todas da organização |

---