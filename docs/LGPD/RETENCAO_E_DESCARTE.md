# RETENÇÃO E DESCARTE — LGPD

Projeto: TeamFlow — Gestão de Equipes  
Versão: 1.0  
Data: 06/11/2026

## 1. POLÍTICA DE RETENÇÃO

O sistema implementa políticas configuráveis de retenção de dados pessoais, conforme Artigo 16 da LGPD.

## 2. PRAZOS DE RETENÇÃO POR TIPO DE DADO

| Tipo de Dado | Prazo | Justificativa | Ação Após o Prazo |
|-------------|-------|---------------|-------------------|
| Dados do usuário ativo | Indeterminado (enquanto ativo) | Contrato de uso | Manter ativo |
| Dados de colaborador desligado | 5 anos | CLT / Obrigação trabalhista | Anonimizar ou reter por obrigação legal |
| Sessões de usuário | 30 dias | Segurança | Revogar sessões expiradas |
| Tokens de recuperação | 24 horas | Segurança | Expirar e inutilizar |
| Logs de auditoria (ActivityLog) | 2 anos | LGPD / Segurança | Arquivar ou anonimizar |
| Notificações | 1 ano | Utilidade para o usuário | Excluir após leitura + prazo |
| Comentários em tarefas | Enquanto a tarefa existir | Contrato | Manter enquanto relevante |
| Anexos de tarefas | Enquanto a tarefa existir | Contrato | Manter enquanto relevante |
| Faturas / pagamentos | 5 anos | Obrigação fiscal | Reter por obrigação legal |
| Logs de incidentes | 5 anos | Segurança / Análise | Reter para investigação |

## 3. MODELO DE RETENÇÃO (RetentionPolicy)

O modelo `RetentionPolicy` permite configurar por organização:

- `entityType`: Tipo de entidade (ex: User, OrganizationMember, ActivityLog)
- `condition`: Condição para aplicar a retenção (ex: "status == 'INATIVO'")
- `action`: Ação a ser executada (DELETE, ANONYMIZE, RETAIN_LEGAL)
- `retentionDays`: Número de dias de retenção
- `legalBasis`: Justificativa legal para retenção
- `isActive`: Se a política está ativa

## 4. PROCEDIMENTO DE DESCARTE

### 4.1. Exclusão (DELETE)

Aplicável quando:
- O titular solicita exclusão (Artigo 18, VI)
- Não há obrigação legal de retenção
- O titular não possui vínculos pendentes (ex: última OWNER)

**Fluxo:**
1. Verificar se há impedimentos (última OWNER, obrigações legais)
2. Executar exclusão em transação atômica
3. Revogar todas as sessões
4. Excluir dados relacionados (preferências, 2FA, tokens, notificações, etc.)
5. Registrar a operação no log de auditoria

### 4.2. Anonimização (ANONYMIZE)

Aplicável quando:
- O titular solicita anonimização (Artigo 18, II)
- É necessário manter registros para auditoria mas não identificar o titular

**Fluxo:**
1. Substituir dados identificadores por valores anônimos
2. Manter registros para integridade referencial
3. Remover CPF, telefone, e-mail pessoais
4. Registrar a operação no log de auditoria

### 4.3. Retenção Legal (RETAIN_LEGAL)

Aplicável quando:
- Há obrigação legal de retenção (CLT, fiscal, trabalhista)
- Há exercício regular de direitos (defesa em processo)

**Fluxo:**
1. Manter os dados com acesso restrito
2. Documentar a justificativa legal
3. Revisar periodicamente a necessidade contínua

## 4.4. Rotina de Limpeza

A rotina de limpeza deve ser executada periodicamente (ex: mensalmente) e:

1. Identificar registros elegíveis para descarte com base nas `RetentionPolicy`
2. Verificar se há impedimentos legais
3. Executar a ação configurada (DELETE, ANONYMIZE, RETAIN_LEGAL)
4. Registrar a operação no log de auditoria
5. Gerar relatório de descarte para a organização

## 5. BACKUPS

Backups são mantidos para recuperação de desastres. Os backups seguem os mesmos prazos de retenção, com expiração automática após o período definido. Não é possível excluir dados individuais de backups existentes; os dados serão removidos naturalmente após a expiração do backup.

## 6. RESPONSABILIDADE

O DPO (Data Protection Officer) da organização é responsável por:
- Definir as políticas de retenção
- Aprovar exclusões em massa
- Revisar periodicamente a necessidade de retenção
- Documentar justificativas legais

---