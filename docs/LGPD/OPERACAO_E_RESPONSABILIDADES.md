# OPERAÇÕES DE TRATAMENTO E RESPONSABILIDADES — LGPD

Projeto: TeamFlow — Gestão de Equipes  
Versão: 1.0  
Data: 06/11/2026

## 1. REGISTRO DAS OPERAÇÕES DE TRATAMENTO (ROPA)

O modelo `ProcessingRecord` implementa o Registro das Operações de Tratamento exigido pelo Artigo 20 da LGPD.

### 1.1. Campos do ProcessingRecord

| Campo | Descrição |
|-------|-----------|
| name | Nome da operação de tratamento |
| description | Descrição detalhada |
| purpose | Finalidade do tratamento |
| legalBasis | Base legal aplicável (enum) |
| dataCategory | Categorias de dados pessoais (array) |
| subjectCategory | Categorias de titulares (array) |
| sharing | Tipo de compartilhamento (enum) |
| sharedWith | Nome do fornecedor/terceiro |
| retentionPeriod | Prazo de retenção |
| securityMeasures | Medidas de segurança aplicadas |
| dpoResponsible | Responsável pela proteção de dados |

## 2. REGISTROS SUGERIDOS

As seguintes operações devem ser registradas por cada organização:

| Operação | Finalidade | Base Legal | Dados | Titulares |
|----------|------------|------------|-------|-----------|
| Cadastro de colaboradores | Gestão de pessoal | Obrigação legal / Contrato | Nome, CPF, e-mail, telefone, cargo | Colaboradores |
| Gestão de equipes | Organização do trabalho | Legítimo interesse | Nomes, vínculos | Colaboradores |
| Gestão de projetos | Gestão de trabalho | Contrato / Legítimo interesse | Nomes, responsáveis | Colaboradores |
| Gestão de tarefas | Controle de atividades | Contrato | Nomes, status, prazos | Colaboradores |
| Controle de produtividade | Análise de desempenho | Legítimo interesse | Métricas de desempenho | Colaboradores |
| Notificações | Comunicação interna | Contrato | E-mail, conteúdo da notificação | Colaboradores |
| Autenticação e sessões | Segurança de acesso | Legítimo interesse | Senha (hash), IP, dispositivo | Usuários |
| Auditoria | Rastreabilidade de operações | Legítimo interesse | Ações, entidades, datas | Colaboradores |
| Integrações | Compartilhamento com terceiros | Contrato / Consentimento | Dados conforme integração | Colaboradores |
| Gestão de contas e assinaturas | Cobrança e plano | Execução de contrato | Dados de pagamento | Organização |

## 3. RESPONSABILIDADES POR AGENTE

### 3.1. Gestão Tech (Fornecedor da Plataforma / Operador)

**Responsabilidades:**
- Manter a plataforma segura e disponível
- Implementar controles técnicos de segurança (criptografia, controle de acesso, auditoria)
- Notificar organizações clientes sobre incidentes na infraestrutura
- Fornecer ferramentas para atendimento aos direitos dos titulares
- Não acessar dados pessoais dos clientes sem autorização

**Não é responsável por:**
- Decidir as bases legais de cada operação
- Definir prazos de retenção específicos por organização
- Responder a solicitações de titulares em nome da organização

### 3.2. Organização Cliente (Controlador)

**Responsabilidades:**
- Definir as bases legais para cada operação de tratamento
- Configurar políticas de retenção de dados
- Designar um DPO (Data Protection Officer)
- Atender solicitações de titulares (acesso, correção, eliminação, etc.)
- Manter o ROPA atualizado
- Comunicar incidentes à ANPD quando necessário
- Obter consentimento quando for a base legal aplicável

### 3.3. DPO (Data Protection Officer)

**Responsabilidades:**
- Supervisionar a conformidade com a LGPD
- Ser o ponto de contato para titulares e autoridades
- Revisar operações de tratamento
- Orientar sobre base legal e retenção
- Coordenar resposta a incidentes de segurança

## 4. CONSENTIMENTO

Quando o consentimento é a base legal:
- O titular deve dar consentimento livre, informado e inequívoco
- O consentimento deve ser registrado (modelo `Consent`)
- O titular pode revogar o consentimento a qualquer momento
- A revogação não compromete o tratamento anterior baseado no consentimento

## 5. COMPARTILHAMENTO DE DADOS

O compartilhamento de dados com terceiros deve ser:
- Documentado no `ProcessingRecord` (campos `sharing` e `sharedWith`)
- Baseado em contrato ou outra base legal
- Transparente para os titulares (informado na política de privacidade)

## 6. POLÍTICA DE PRIVACIDADE

Cada organização deve:
- Publicar uma política de privacidade versãoada (modelo `PrivacyPolicy`)
- Informar quais dados são tratados, para quais finalidades e com quem são compartilhados
- Registrar a versão apresentada a cada usuário
- Registrar o aceite de consentimento quando aplicável (modelo `Consent`)

---