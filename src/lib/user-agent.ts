// ------------------------------------------------------------
// Parser de user-agent (puro, testável) · IP mascarado p/ UI
// ------------------------------------------------------------

export type UaInfo = { browser: string; device: string; os: string };

export function parseUserAgent(ua: string | null | undefined): UaInfo {
  const lower = (ua ?? "").toLowerCase();

  let browser = "Navegador";
  if (/edg\//.test(lower)) browser = "Edge";
  else if (/opr\//.test(lower) || /opera/.test(lower)) browser = "Opera";
  else if (/crios\//.test(lower) || /chrome\//.test(lower)) browser = "Chrome";
  else if (/fxios/.test(lower) || /firefox\//.test(lower)) browser = "Firefox";
  else if (/safari\//.test(lower)) browser = "Safari";

  let os = "Sistema";
  if (/windows nt/.test(lower)) os = "Windows";
  else if (/android/.test(lower)) os = "Android";
  else if (/iphone|ipad|ios/.test(lower)) os = "iOS";
  else if (/mac os x|macintosh/.test(lower)) os = "macOS";
  else if (/linux/.test(lower)) os = "Linux";

  let device = "Dispositivo";
  if (/ipad/.test(lower)) device = "Tablet";
  else if (/iphone|ipod/.test(lower)) device = "Celular";
  else if (/android/.test(lower))
    device = /mobi|mobile/.test(lower) ? "Celular" : "Tablet";
  else if (/windows|macintosh|mac os|linux|x11/.test(lower)) device = "Computador";

  return { browser, device, os };
}

/** Mascara o último octeto (IPv4) ou o sufixo (IPv6) para exibição segura. */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const v4 = ip.replace(/^::ffff:/, "");
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v4)) {
    const parts = v4.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  }
  const idx = ip.lastIndexOf(":");
  return idx > -1 ? `${ip.slice(0, idx)}:x` : ip;
}