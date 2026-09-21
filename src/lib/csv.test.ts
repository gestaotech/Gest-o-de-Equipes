import { describe, expect, it } from "vitest";
import { csvField, toCsv } from "./csv";

describe("csvField", () => {
  it("escapa vírgulas, aspas e quebras de linha", () => {
    expect(csvField('a,"b",c')).toBe('"a,""b"",c"');
    expect(csvField("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });
  it("nulos viram vazio", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("adiciona BOM e separa com CRLF", () => {
    const out = toCsv(["A", "B"], [["1", "2"]]);
    expect(out.startsWith("\uFEFF")).toBe(true);
    expect(out).toContain("\r\n");
  });
  it("monta headers e linhas", () => {
    const out = toCsv(["Nome", "Taxa"], [["Ana", 90]]);
    expect(out.slice(1)).toBe('Nome,Taxa\r\nAna,90\r\n');
  });
});