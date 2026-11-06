# INCIDENTES DE SEGURANÇA — LGPD

Projeto: TeamFlow — Gestão de Equipes  
Versão: 1.0  
Data: 06/11/2026

## 1. INTRODUÇÃO

O sistema implementa um módulo de gestão de incidentes de segurança para registrar, acompanhar e documentar incidentes que possam afetar dados pessoais, conforme exigido pela LGPD e pela ANPD.

## 2. MODELO SecurityIncident

| Campo | Tipo | Descrição |
|-------|------|-----------|
| title | String | Título do incidente |
| description | String | Descrição detalhada |
| category | String | Categoria (ex: data_breach, unauthorized_access, leak, phishing) |
| severity | Enum | LOW, MEDIUM, HIGH, CRITICAL |
| status | Enum | OPEN, INVESTIGATING, CONTAINED, RESOLVED, CLOSED |
| systemsAffected | String? | Sistemas afetados |
| dataCompromised | String? | Dados potencialmente comprometidos |
| subjectsAffected | Int? | Quantidade de titulares afetados |
| organizationsAffected | Int? | Quantidade de organizações afetadas |
| containmentMeasures | String? | Medidas de contenção aplicadas |
| responsePlan | String? | Plano de resposta |
| responsibleId | String? | Responsável pelo incidente |
| evidenceUrl | String? | Link para evidências |
| notifiedAuthorityAt | DateTime? | Comunicação à ANPD |
| notifiedSubjectsAt | DateTime? | Comunicação aos titulares |
| createdAt / updatedAt / resolvedAt | DateTime | Cronologia do incidente |

## 3. FLUXO DE GESTÃO DE INCIDENTES

### 3.1. Registro do Incidente

Qualquer usuário autorizado pode registrar um incidente através da API ou interface. O incidente é vinculado à organização do usuário.

### 3.2. Classificação de Severidade

| Severidade | Critério | Ação Imediata |
|------------|----------|---------------|
| LOW | Incidente menor, nenhum dado pessoal exposto | Documentar e monitorar |
| MEDIUM | Possível exposição limitada de dados | Investigar em 24h |
| HIGH | Exposição confirmada de dados pessoais | Investigar em 4h, considerar comunicação |
| CRITICAL | Vazamento em larga escala de dados sensíveis | Comunicar ANPD e titulares em até 72h |

### 3.3. Comunicação

O sistema suporta o processo de comunicação, mas a decisão de comunicar à ANPD e aos titulares é de responsabilidade jurídica da organização, conforme regulamentação vigente.

- `notifiedAuthorityAt`: Data de comunicação à ANPD
- `notifiedSubjectsAt`: Data de comunicação aos titulares afetados

## 4. RESPONSABILIDADES

| Ator | Responsabilidade |
|------|------------------|
| Gestão Tech (fornecedor da plataforma) | Manter a plataforma segura, notificar clientes sobre incidentes na infraestrutura |
| Organização cliente (controlador) | Decidir sobre comunicação, gerenciar incidentes internos, responder à ANPD |
| DPO da organização | Coordenar resposta a incidentes, documentar decisões |

## 5. EVIDÊNCIAS

O campo `evidenceUrl` permite vincular evidências do incidente (logs, capturas de tela, relatórios forenses) para auditoria posterior.

---