import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { requireSessionApi, getActiveOrg } from "@/lib/auth";

/**
 * Sanitiza dados removendo campos sensíveis antes de armazenar no audit log.
 * Nunca armazena senhas, tokens, chaves de API ou outros segredos.
 */
function sanitizeAuditData(data: unknown): unknown {
  if (data === null || data === undefined || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeAuditData);
  }

  const sanitized = {} as Record<string, unknown>;
  const sensitiveKeys = new Set([
    "password",
    "passwordhash",
    "token",
    "refreshtoken",
    "sessiontoken",
    "apikey",
    "keyhash",
    "secret",
    "authorization",
    "cookie",
    "csrftoken",
    "resettoken",
  ]);

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof key === "string" && !sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = sanitizeAuditData(value);
    }
  }

  return sanitized;
}

/**
 * Extrai metadados da requisição (IP e user-agent) de forma segura.
 * Nunca confia em valores enviados pelo cliente diretamente.
 */
async function extractRequestMeta() {
  try {
    const h = await headers();
    const userAgent = h.get("user-agent") ?? undefined;
    
    // Extra IP do cabeçalho X-Forwarded-Of (com suporte a proxies) ou X-Real-IP
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      undefined;

    return { userAgent, ip };
  } catch {
    // Em caso de erro (executando fora de contexto de requisição), retorna valores vazios
    return { userAgent: undefined, ip: undefined };
  }
}

/**
 * Cria um registro de log de atividade com contexto automático.
 * Obtém organização e usuário da sessão, e IP/user-agent da requisição.
 *
 * @param action - Ação realizada (ex: "TASK_CREATED", "PROFILE_UPDATED")
 * @param entity - Tipo de entidade (ex: "TASK", "USER", "PROJECT")
 * @param entityId - ID da entidade (opcional)
 * @param oldData - Dados antes da alteração (opcional, será sanitizado)
 * @param newData - Dados após a alteração (opcional, será sanitizado)
 * @param metadata - Metadados adicionais (opcional, será sanitizado)
 */
export async function logActivity({
  action,
  entity,
  entityId,
  oldData,
  newData,
  metadata,
}: {
  action: string;
  entity: string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Obtém sessão e organização ATIVA (cookie tf_org), mesma fonte das actions
    const session = await requireSessionApi();
    const org = await getActiveOrg(session);
    if (!org) {
      // Se não há organização ativa, não registra atividade (deve acontecer apenas em contextos como onboarding)
      return;
    }
    const orgId = org.id;

// Extrai metadados da requisição
     const { userAgent, ip } = await extractRequestMeta();

     // Sanitiza todos os dados de entrada
     const sanitizedOld = oldData ? sanitizeAuditData(oldData) : null;
     const sanitizedNew = newData ? sanitizeAuditData(newData) : metadata ? sanitizeAuditData(metadata) : null;

    // Cria o registro de atividade
await prisma.activityLog.create({
       data: {
         organizationId: orgId,
         userId: session.sub,
         action,
         entity,
         entityId: entityId ?? null,
         oldData: sanitizedOld ? (sanitizedOld as Prisma.InputJsonValue) : Prisma.JsonNull,
         newData: sanitizedNew ? (sanitizedNew as Prisma.InputJsonValue) : Prisma.JsonNull,
         ipAddress: ip ?? null,
         userAgent: userAgent ?? null,
       },
     });
  } catch (err) {
    // Log de erro não deve quebrar a aplicação principal
    console.error("[activity]", err);
  }
}

/**
 * Função auxiliar para registrar atividades com dados antigos e novos (diff).
 * Útil quando se tem os objetos antes e depois de uma alteração.
 */
export async function logActivityDiff({
  action,
  entity,
  entityId,
  oldObj,
  newObj,
  metadata,
}: {
  action: string;
  entity: string;
  entityId?: string | null;
  oldObj?: Record<string, unknown>;
  newObj?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
await logActivity({
          action,
          entity,
          entityId,
          oldData: oldObj,
          newData: newObj,
          metadata,
        });
    }

   /**
    * Cria uma notificação para um usuário específico.
    * @param organizationId - ID da organização
    * @param userId - ID do usuário que receberá a notificação
    * @param type - Tipo da notificação (ex: "announcement", "task", etc.)
    * @param title - Título da notificação
    * @param message - Mensagem da notificação (opcional)
    */
   export async function notify(
     organizationId: string,
     userId: string,
     type: string,
     title: string,
     message?: string
   ): Promise<void> {
     try {
       await prisma.notification.create({
         data: {
           organizationId,
           userId,
           type,
           title,
           message: message ?? null,
         },
       });
     } catch (err) {
       // Notificação não deve quebrar a aplicação principal
       console.error("[notify]", err);
     }
   }