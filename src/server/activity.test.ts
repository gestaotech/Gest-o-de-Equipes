import { describe, it, expect, vi, beforeEach, type Mock, type MockedFunction } from "vitest";
import { prisma } from "@/lib/prisma";
import { logActivity, logActivityDiff } from "@/server/activity";
import { requireSessionApi, type SessionPayload } from "@/lib/auth";

// Mock do prisma.client para o tipo Prisma
vi.mock("@prisma/client", () => ({
  Prisma: {
    JsonValue: {
      from: vi.fn().mockImplementation((value) => value)
    },
    JsonNull: {}
  }
}));

// Mock do prisma para a instância do prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityLog: {
      create: vi.fn()
    }
  }
}));

// Mock do requireSessionApi
vi.mock("@/lib/auth", () => ({
  requireSessionApi: vi.fn(),
  sessionTokenHash: vi.fn()
}));

// Mock do headers from next/headers
vi.mock("next/headers", () => ({
   headers: vi.fn().mockResolvedValue({
     get: () => undefined
   })
}));

describe("Activity Service", () => {
  const mockSession: SessionPayload = {
    sub: "user-123",
    email: "test@example.com",
    name: "Test User",
    orgId: "org-123",
    sid: "session-123"
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireSessionApi as MockedFunction<typeof requireSessionApi>).mockResolvedValue(mockSession);
  });

  describe("logActivity", () => {
    it("should create an activity log with correct data", async () => {
      await logActivity({
        action: "TASK_CREATED",
        entity: "TASK",
        entityId: "task-123",
        newData: { title: "Test Task" }
      });

expect(prisma.activityLog.create).toHaveBeenCalled();
       const callArgs = (prisma.activityLog.create as Mock).mock.calls[0][0];
       
       expect(callArgs.data).toMatchObject({
        organizationId: mockSession.orgId,
        userId: mockSession.sub,
        action: "TASK_CREATED",
        entity: "TASK",
        entityId: "task-123",
        ipAddress: null,
        userAgent: null
      });
    });

    it("should sanitize sensitive data", async () => {
      await logActivity({
        action: "PASSWORD_CHANGED",
        entity: "USER",
        newData: {
          password: "secret123",
          passwordHash: "hashed_secret",
          token: "abc123",
          safeField: "safe_value"
        }
      });

expect(prisma.activityLog.create).toHaveBeenCalled();
       const callArgs = (prisma.activityLog.create as Mock).mock.calls[0][0];
       
       const newData = callArgs.data.newData;
      
      // Verifica que dados sensíveis foram removidos
      expect(newData).not.toHaveProperty("password");
      expect(newData).not.toHaveProperty("passwordHash");
      expect(newData).not.toHaveProperty("token");
      // Verifica que dados seguros foram mantidos
      expect(newData).toHaveProperty("safeField");
    });

    it("should handle null/undefined values correctly", async () => {
      await logActivity({
        action: "TEST_ACTION",
        entity: "TEST_ENTITY"
      });

expect(prisma.activityLog.create).toHaveBeenCalled();
       const callArgs = (prisma.activityLog.create as Mock).mock.calls[0][0];
       
       expect(callArgs.data.entityId).toBeNull();
      // Em Prisma, JSON null é representado como JsonNull object, não como null
      expect(typeof callArgs.data.oldData).toBe("object");
      expect(typeof callArgs.data.newData).toBe("object");
    });

it("should not throw error if database operation fails", async () => {
       (prisma.activityLog.create as Mock).mockRejectedValueOnce(new Error("Database error"));
      
      // Não deve lançar exceção
      await expect(logActivity({
        action: "TEST_ACTION",
        entity: "TEST_ENTITY"
      })).resolves.not.toThrow();
      
      // Mas deve ter tentado criar o log
      expect(prisma.activityLog.create).toHaveBeenCalled();
    });
  });

  describe("logActivityDiff", () => {
    it("should create activity log with old and new data", async () => {
      const oldObj = { status: "TODO", title: "Old Title" };
      const newObj = { status: "DONE", title: "New Title" };
      
      await logActivityDiff({
        action: "TASK_UPDATED",
        entity: "TASK",
        entityId: "task-123",
        oldObj,
        newObj
      });

expect(prisma.activityLog.create).toHaveBeenCalled();
       const callArgs = (prisma.activityLog.create as Mock).mock.calls[0][0];
       
       expect(callArgs.data.action).toBe("TASK_UPDATED");
      expect(callArgs.data.entity).toBe("TASK");
      expect(callArgs.data.entityId).toBe("task-123");
      // Os dados devem ter sido passados para oldData e newData
      expect(typeof callArgs.data.oldData).toBe("object");
      expect(typeof callArgs.data.newData).toBe("object");
    });
  });
});