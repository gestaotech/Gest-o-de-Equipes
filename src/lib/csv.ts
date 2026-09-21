// ------------------------------------------------------------
// Exportação CSV nativa (sem dependências): escape RFC 4180 + BOM
// para abrir corretamente encodado UTF-8 (ex.: Excel pt-BR).
// ------------------------------------------------------------

export function csvField(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined | boolean)[][]
): string {
  const lines = [
    headers.map(csvField).join(","),
    ...rows.map((row) => row.map(csvField).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}