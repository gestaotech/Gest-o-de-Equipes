import { describe, expect, it } from "vitest";
import {
  AT_RISK_DAYS,
  AT_RISK_PROGRESS,
  completionRate,
  isGoalAtRisk,
  isProjectOverdue,
  isTaskOverdue,
  periodRange,
  progressPercent,
} from "./indicator-metrics";

describe("completionRate", () => {
  it("retorna null quando não há tarefas (Sem dados ≠ 0%)", () => {
    expect(completionRate(0, 0)).toBeNull();
  });
  it("calcula percentual com 1 casa", () => {
    expect(completionRate(5, 10)).toBe(50);
    expect(completionRate(1, 3)).toBe(33.3);
  });
});

describe("progressPercent", () => {
  it("limita entre 0 e 100", () => {
    expect(progressPercent(12, 10)).toBe(100);
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(4, 10)).toBe(40);
  });
});

describe("isTaskOverdue", () => {
  const now = new Date("2026-09-21T12:00:00");
  it("não conta tarefa concluída como atrasada", () => {
    expect(isTaskOverdue("DONE", new Date("2026-09-01"), now)).toBe(false);
  });
  it("atrasa quando prazo vencido e não concluída", () => {
    expect(isTaskOverdue("IN_PROGRESS", new Date("2026-09-01"), now)).toBe(true);
  });
  it("não atrasa com prazo futuro ou ausente", () => {
    expect(isTaskOverdue("TODO", new Date("2026-10-01"), now)).toBe(false);
    expect(isTaskOverdue("TODO", null, now)).toBe(false);
  });
});

describe("isProjectOverdue", () => {
  const now = new Date("2026-09-21T12:00:00");
  it("concluído não fica atrasado mesmo com prazo vencido", () => {
    expect(isProjectOverdue("CONCLUIDO", new Date("2026-09-01"), now)).toBe(false);
  });
  it("em andamento com prazo vencido fica atrasado", () => {
    expect(isProjectOverdue("EM_ANDAMENTO", new Date("2026-09-01"), now)).toBe(true);
  });
});

describe("isGoalAtRisk (regra objetiva)", () => {
  const now = new Date("2026-09-21T12:00:00");
  const inDays = (d: number) => new Date(now.getTime() + d * 86400000);
  it("risco = EM_ANDAMENTO + prazo ≤ limite + progresso < 80", () => {
    expect(isGoalAtRisk("EM_ANDAMENTO", inDays(5), 50, now)).toBe(true);
  });
  it("progresso suficiente tira o risco", () => {
    expect(isGoalAtRisk("EM_ANDAMENTO", inDays(5), 90, now)).toBe(false);
  });
  it("prazo longe do fim não é risco", () => {
    expect(isGoalAtRisk("EM_ANDAMENTO", inDays(30), 10, now)).toBe(false);
  });
  it("sem prazo ou fora de EM_ANDAMENTO nunca é risco", () => {
    expect(isGoalAtRisk("EM_ANDAMENTO", null, 10, now)).toBe(false);
    expect(isGoalAtRisk("CONCLUIDO", inDays(5), 50, now)).toBe(false);
  });
  it("constantes documentadas", () => {
    expect(AT_RISK_DAYS).toBe(14);
    expect(AT_RISK_PROGRESS).toBe(80);
  });
});

describe("periodRange", () => {
  it("month começa no dia 1", () => {
    const r = periodRange("month");
    expect(r?.from).toBeInstanceOf(Date);
    if (r) expect(r.from.getDate()).toBe(1);
  });
  it("custom válido vai até o fim do dia escolhido", () => {
    const r = periodRange("custom", "2026-09-01", "2026-09-10");
    expect(r?.from.getTime()).toBe(new Date("2026-09-01T00:00:00").getTime());
    expect(r?.to?.getTime()).toBe(new Date("2026-09-11T00:00:00").getTime());
  });
  it("custom inválido retorna null", () => {
    expect(periodRange("custom")).toBeNull();
    expect(periodRange("custom", "2026-09-10", "2026-09-01")).toBeNull();
    expect(periodRange("custom", "abc", "2026-09-01")).toBeNull();
  });
  it("7d volta 7 dias do início do dia", () => {
    const r = periodRange("7d");
    expect(r?.from.getHours()).toBe(0);
  });
});