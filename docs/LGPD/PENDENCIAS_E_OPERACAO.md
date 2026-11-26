# Pendências e operação — LGPD

Este documento registra pontos que **não** estão completos apenas com a implementação técnica atual. Ele não substitui orientação jurídica.

## Status técnico (resumo)

| Tema | Situação atual | Pendente |
|---|---|---|
| Inventário, bases legais, direitos e segurança | Documentados em `docs/LGPD/` e parcialmente suportados no sistema | Revisão jurídica e validação com a operação real |
| CPF | Armazenado criptografado (AES-256-GCM) com índice HMAC; coluna em texto puro ausente no schema e no banco de produção; migration `20261112140000_drop_plain_cpf` confirmada como aplicada | Rotação de chaves e procedimento de migração/recifragem se a chave mudar |
| Exportação de dados | Geração sob demanda e download direto no navegador (JSON), autenticado | Verificação de identidade reforçada antes de atender solicitações sensíveis; entrega por canal seguro com link temporário, se exigido pelo processo |
| Solicitações de titulares | Registro, prazo, histórico e ações administrativas no sistema | Fluxo formal de verificação de identidade, SLA operacional e evidências de atendimento |
| Retenção | Job diário para `activity_logs` e `notifications` lidas (DELETE, prazo mínimo 30 dias) | Políticas para outros tipos, anonimização/retenção legal quando aplicável, revisão periódica |
| Incidentes | Registro no sistema | Plano de resposta testado, critérios de notificação à ANPD/titulares e simulações |
| Webhook/billing | Validação por token, idempotência e atualização de status por eventos de pagamento mapeados | Tratamento de eventos de assinatura conforme necessidade, modelo de faturas (hoje 1 fatura por assinatura) e conciliação operacional |

## Itens não técnicos

- **Verificação de identidade do titular:** definir como a organização confirma a identidade antes de exportar, corrigir, anonimizar ou excluir dados (documentos, canal autenticado, registro da evidência).
- **Entrega segura da exportação:** se o processo exigir envio por link, o link deve ser temporário, de uso controlado e registrado; hoje a exportação é baixada na sessão autenticada.
- **Rotação de chaves (`ENCRYPTION_KEY`, `ENCRYPTION_HMAC_KEY`, `AUTH_SECRET`):** definir procedimento, janela de manutenção e, para dados criptografados, recifragem com a chave antiga e a nova. Trocar a chave sem recifrar torna dados já criptografados ilegíveis.
- **RIPD (Relatório de Impacto à Proteção de Dados Pessoais):** elaborar quando aplicável, com base nas operações de tratamento reais.
- **Encarregado (DPO):** designar formalmente, publicar canal de contato e registrar a responsabilidade.
- **Revisão jurídica:** validar bases legais, contratos com operadores/suboperadores, política de privacidade, termos e procedimentos de resposta a titulares e incidentes.
- **Fornecedores:** manter acordos e cláusulas de proteção de dados com provedores (hospedagem, banco, e-mail, pagamentos), conforme `docs/LGPD/FORNECEDORES.md`.

## Operação mínima recomendada antes do uso em produção

1. Corrigir a conexão `DATABASE_URL` no Vercel e validar acesso ao banco.
2. Configurar `CRON_SECRET` e testar o cron de retenção; configurar SMTP se recuperação de senha por e-mail for necessária.
3. Manter Asaas/checkout desativados até decisão de reativação.
4. Definir encarregado, canal de atendimento ao titular e procedimento de verificação de identidade.
5. Revisar e publicar a política de privacidade e os termos aplicáveis.