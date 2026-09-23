import { describe, it, expect } from "vitest";
import { parseUserAgent, maskIp } from "@/lib/user-agent";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("parseUserAgent", () => {
  it("identifica Chrome no Windows", () => {
    expect(parseUserAgent(CHROME_WIN)).toEqual({
      browser: "Chrome",
      device: "Computador",
      os: "Windows",
    });
  });

  it("identifica Safari no iPhone", () => {
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({
      browser: "Safari",
      device: "Celular",
      os: "iOS",
    });
  });

  it("identifica Firefox no macOS", () => {
    expect(parseUserAgent(FIREFOX_MAC)).toEqual({
      browser: "Firefox",
      device: "Computador",
      os: "macOS",
    });
  });

  it("identifica Safari em iPad como tablet", () => {
    const info = parseUserAgent(IPAD);
    expect(info.device).toBe("Tablet");
    expect(info.os).toBe("iOS");
  });

  it("resiste a entradas vazias", () => {
    expect(parseUserAgent(null)).toEqual({
      browser: "Navegador",
      device: "Dispositivo",
      os: "Sistema",
    });
    expect(parseUserAgent(undefined)).toEqual({
      browser: "Navegador",
      device: "Dispositivo",
      os: "Sistema",
    });
  });
});

describe("maskIp", () => {
  it("mascara o último octeto IPv4", () => {
    expect(maskIp("189.45.12.7")).toBe("189.45.12.x");
  });

  it("normaliza IPv4-mapped", () => {
    expect(maskIp("::ffff:189.45.12.7")).toBe("189.45.12.x");
  });

  it("mascara o sufixo IPv6", () => {
    expect(maskIp("2001:db8::1")).toBe("2001:db8::x");
  });

  it("retorna null para ausente", () => {
    expect(maskIp(null)).toBeNull();
    expect(maskIp(undefined)).toBeNull();
  });
});