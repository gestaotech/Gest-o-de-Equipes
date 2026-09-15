import { randomBytes, scryptSync } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { prisma } from './_db';

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verificarSenha(senha: string, armazenada: string): boolean {
  const idx = armazenada.indexOf(':');
  if (idx === -1) return false;
  const salt = armazenada.slice(0, idx);
  const hash = armazenada.slice(idx + 1);
  if (!salt || !hash) return false;
  return scryptSync(senha, salt, 64).toString('hex') === hash;
}

export function extrairToken(req: VercelRequest): string {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function getUsuarioDaRequisicao(req: VercelRequest) {
  const token = extrairToken(req);
  if (!token) return null;
  const sessao = await prisma.sessao.findUnique({
    where: { token },
    include: { usuario: true }
  });
  return sessao ? sessao.usuario : null;
}