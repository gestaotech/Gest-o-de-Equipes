import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const FILES = [
  "src/server/people-actions.ts",
  "src/lib/validations.ts",
  "src/server/auth-actions.ts",
  "src/server/account-token.ts",
];

/**
 * Garante que o cadastro de colaborador não volte a gerar e-mails fictícios
 * (`@sem-email.teamflow` / `uniqueDummyEmail`) — o e-mail agora é obrigatório.
 */
describe("cadastro não gera e-mail fictício", () => {
  it("não contém @sem-email.teamflow nem uniqueDummyEmail", () => {
    for (const file of FILES) {
      const content = readFileSync(join(process.cwd(), file), "utf8");
      expect(content).not.toMatch(/sem-email/i);
      expect(content).not.toMatch(/uniqueDummyEmail/);
    }
  });
});
