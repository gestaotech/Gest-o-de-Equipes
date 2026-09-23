import type { z } from "zod";
import { userPreferencesSchema } from "@/lib/validations";

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "light",
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  taskNotifications: true,
  projectNotifications: true,
  goalNotifications: true,
  announcementNotifications: true,
};

/** IANA curadas usadas na UI do perfil. */
export const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Sao_Paulo", label: "Brasília · America/Sao_Paulo" },
  { value: "America/Manaus", label: "Manaus · America/Manaus" },
  { value: "America/Rio_Branco", label: "Rio Branco · America/Rio_Branco" },
  { value: "America/Noronha", label: "Noronha · America/Noronha" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/Lisbon", label: "Lisboa · Europe/Lisbon" },
  { value: "America/New_York", label: "Nova York · America/New_York" },
];

export const LOCALES: { value: string; label: string }[] = [
  { value: "pt-BR", label: "Português (Brasil)" },
];

export type NotifiablePrefKey =
  | "taskNotifications"
  | "projectNotifications"
  | "goalNotifications"
  | "announcementNotifications";

/** Mapeia o tipo da notificação para a preferência que a controla. */
export function preferenceKeyForType(type: string): NotifiablePrefKey | null {
  if (type.startsWith("task") || type === "mention") return "taskNotifications";
  if (type.startsWith("project")) return "projectNotifications";
  if (type.startsWith("goal")) return "goalNotifications";
  if (type === "announcement") return "announcementNotifications";
  return null;
}
