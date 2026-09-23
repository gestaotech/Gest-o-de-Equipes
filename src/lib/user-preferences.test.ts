import { describe, it, expect } from "vitest";
import {
  DEFAULT_USER_PREFERENCES,
  preferenceKeyForType,
} from "@/lib/user-preferences";

describe("DEFAULT_USER_PREFERENCES", () => {
  it("padrões globais coerentes", () => {
    expect(DEFAULT_USER_PREFERENCES).toMatchObject({
      theme: "light",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      taskNotifications: true,
      projectNotifications: true,
      goalNotifications: true,
      announcementNotifications: true,
    });
  });
});

describe("preferenceKeyForType", () => {
  it("mapaia tarefas e menções", () => {
    expect(preferenceKeyForType("task.created")).toBe("taskNotifications");
    expect(preferenceKeyForType("mention")).toBe("taskNotifications");
  });

  it("mapaia projetos", () => {
    expect(preferenceKeyForType("project.updated")).toBe("projectNotifications");
  });

  it("mapaia metas", () => {
    expect(preferenceKeyForType("goal.risk")).toBe("goalNotifications");
  });

  it("mapaia avisos", () => {
    expect(preferenceKeyForType("announcement")).toBe("announcementNotifications");
  });

  it("retorna null para tipos desconhecidos", () => {
    expect(preferenceKeyForType("kpi.created")).toBeNull();
    expect(preferenceKeyForType("")).toBeNull();
  });
});