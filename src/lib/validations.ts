import { z } from "zod";

const pass = z
  .string()
  .min(6, "A senha precisa de no mínimo 6 caracteres.")
  .max(72, "Senha muito longa.");

const name = z.string().min(2, "Informe seu nome.").max(80, "Nome muito longo.");

const email = z.string().email("Informe um e-mail válido.").max(160);

export const signUpSchema = z.object({
  name,
  email,
  password: pass,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha."),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({
    token: z.string().min(1),
    password: pass,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  });

export const orgSchema = z.object({
  name: z.string().min(2, "Informe o nome da empresa.").max(100).trim(),
  slug: z
    .string()
    .min(2, "Slug muito curto.")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens.")
    .optional(),
  segment: z.string().max(60).optional(),
  size: z.string().max(30).optional(),
});

export const orgUpdateSchema = z.object({
  name: z.string().min(2, "Informe o nome da empresa.").max(100).trim(),
  segment: z.string().max(60).nullable().optional(),
  size: z.string().max(30).nullable().optional(),
});

export const accountUpdateSchema = z
  .object({
    name: name.optional(),
    currentPassword: z.string().min(1, "Informe a senha atual.").max(72).optional(),
    newPassword: pass.optional(),
  })
  .refine((d) => !d.newPassword || d.currentPassword, {
    message: "Informe a senha atual para alterar a senha.",
    path: ["currentPassword"],
  });

/** Perfil pessoal — aceita SOMENTE campos do usuário (anti mass-assignment). */
export const profileSchema = z.object({
  name: z.string().min(2, "Informe seu nome.").max(120, "Nome muito longo.").trim(),
  phone: z
    .string()
    .max(30, "Telefone inválido.")
    .regex(/^[0-9+\-\s().]{8,20}$/, "Telefone inválido.")
    .nullable()
    .optional(),
});

/** Alteração de senha — senha atual + nova + confirmação. */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual.").max(72),
    newPassword: pass,
    confirm: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "A nova senha não pode ser igual à atual.",
    path: ["newPassword"],
  });

/** Preferências globais do usuário (fora do tenant). */
export const userPreferencesSchema = z.object({
  theme: z.enum(["light", "system", "dark"]),
  locale: z.string().min(2).max(10),
  timezone: z.string().min(2).max(60),
  taskNotifications: z.boolean(),
  projectNotifications: z.boolean(),
  goalNotifications: z.boolean(),
  announcementNotifications: z.boolean(),
});

export const onboardingSchema = z.object({
  step: z.number().int().min(0).max(7),
  companyName: z.string().max(120).optional(),
  segment: z.string().max(60).optional(),
  size: z.string().max(30).optional(),
  goal: z.string().max(120).optional(),
  teamName: z.string().max(80).optional(),
  projectName: z.string().max(100).optional(),
  taskTitle: z.string().max(140).optional(),
  taskDue: z.string().optional(),
});

export const departmentSchema = z.object({
  name: z.string().min(2, "Informe o nome do departamento.").max(80).trim(),
  description: z.string().max(240).optional().nullable(),
});

export const teamSchema = z.object({
  name: z.string().min(2, "Informe o nome da equipe.").max(80).trim(),
  description: z.string().max(240).optional().nullable(),
  departmentId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  memberIds: z.array(z.string()).optional().default([]),
});

export const collaboratorSchema = z.object({
  name: z.string().min(2, "Informe o nome.").max(80).trim(),
  cpf: z
    .string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido.")
    .refine((cpf) => {
      // Validação simples de CPF (todos dígitos iguais rejeitados)
      const cleaned = cpf.replace(/\D/g, "");
      if (/^(\d)\1+$/.test(cleaned)) return false;
      // Cálculo dos dígitos verificadores
      let sum = 0;
      for (let i = 0; i < 9; i++) sum += parseInt(cleaned.charAt(i)) * (10 - i);
      const remainder = sum % 11;
      const digit1 = remainder < 2 ? 0 : 11 - remainder;
      if (parseInt(cleaned.charAt(9)) !== digit1) return false;
      sum = 0;
      for (let i = 0; i < 10; i++) sum += parseInt(cleaned.charAt(i)) * (11 - i);
      const remainder2 = sum % 11;
      const digit2 = remainder2 < 2 ? 0 : 11 - remainder2;
      return parseInt(cleaned.charAt(10)) === digit2;
    }, "CPF inválido."),
  email: z.string().email("E-mail inválido.").max(160).trim().toLowerCase(),
  jobTitle: z.string().max(80).optional(),
  permission: z.string().optional(), // OWNER|ADMIN|MANAGER|LEADER|MEMBER
  departmentId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  entryDate: z.string().optional().nullable(),
  phone: z
    .string()
    .regex(/^[0-9+\-\s()]{8,20}$/, "Telefone inválido.")
    .optional(),
});

export const projectSchema = z.object({
  name: z.string().min(2, "Informe o nome do projeto.").max(120).trim(),
  description: z.string().max(1000).optional().nullable(),
  status: z.string().optional(),
  priority: z.string().optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  memberIds: z.array(z.string()).optional().default([]),
});

export const taskSchema = z.object({
  title: z.string().min(2, "Informe o título da tarefa.").max(160).trim(),
  description: z.string().max(2000).optional().nullable(),
  status: z.string().optional(),
  priority: z.string().optional(),
  projectId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional().default([]),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

export const commentSchema = z.object({
  taskId: z.string().min(1),
  text: z.string().min(1, "Escreva um comentário.").max(4000),
});

export const goalSchema = z.object({
  title: z.string().min(2, "Informe o título da meta.").max(120).trim(),
  description: z.string().max(1000).optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  startValue: z.coerce.number().optional(),
  targetValue: z.coerce.number().optional(),
  status: z.string().optional(),
  dueDate: z.string().optional().nullable(),
});

export const eventSchema = z.object({
  title: z.string().min(2, "Informe o título.").max(120).trim(),
  description: z.string().max(600).optional().nullable(),
  type: z.string().optional(),
  allDay: z.boolean().optional(),
  startsAt: z.string().min(1, "Informe data/hora."),
  endsAt: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
});

export const announcementSchema = z.object({
  title: z.string().min(2, "Informe o título.").max(140).trim(),
  message: z.string().min(2, "Escreva a mensagem.").max(4000),
  audience: z.string().optional(),
  audienceId: z.string().optional().nullable(),
});

export const idSchema = z.object({ id: z.string().min(1) });

/**
 * Filtros de indicadores/relatórios. `.strict()` garante que
 * organização venha SEMPRE da sessão no servidor (nunca do cliente).
 */
export const indicatorScopeSchema = z
  .object({
    period: z
      .enum(["today", "7d", "30d", "90d", "month", "prevMonth", "quarter", "year", "custom"])
      .optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    teamId: z.string().optional(),
    departmentId: z.string().optional(),
    memberId: z.string().optional(),
    projectId: z.string().optional(),
    status: z
      .enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"])
      .optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  })
  .strict();

export const pgEnumValues = {
  role: ["OWNER", "ADMIN", "MANAGER", "LEADER", "MEMBER"],
  memberStatus: ["ATIVO", "INATIVO"],
  projectStatus: ["PLANEJAMENTO", "EM_ANDAMENTO", "PAUSADO", "CONCLUIDO"],
  projectPriority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
  taskStatus: ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"],
  taskPriority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
  goalStatus: ["PLANEJAMENTO", "EM_ANDAMENTO", "CONCLUIDO"],
} as const;