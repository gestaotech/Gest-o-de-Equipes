import { randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_db';
import { hashSenha, verificarSenha, getUsuarioDaRequisicao, extrairToken } from './_auth';

function gerarToken(): string {
  return randomBytes(24).toString('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const usuario = await getUsuarioDaRequisicao(req);
      if (!usuario) {
        return res.status(401).json({ erro: 'Não autenticado.' });
      }
      return res.json({ usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
    }

    if (req.method === 'POST') {
      const body = (req.body || {}) as { action?: string; nome?: string; email?: string; senha?: string };
      const { action } = body;

      if (action === 'registrar') {
        const nome = (body.nome || '').trim();
        const email = (body.email || '').toLowerCase().trim();
        const senha = body.senha || '';
        if (!nome || !email || !senha) {
          return res.status(400).json({ erro: 'Informe nome, e-mail e senha.' });
        }
        const existe = await prisma.usuario.findUnique({ where: { email } });
        if (existe) {
          return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
        }
        const usuario = await prisma.usuario.create({
          data: { nome, email, senha: hashSenha(senha) }
        });
        const token = gerarToken();
        await prisma.sessao.create({ data: { token, usuarioId: usuario.id } });
        return res.status(201).json({
          token,
          usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
        });
      }

      if (action === 'login') {
        const email = (body.email || '').toLowerCase().trim();
        const senha = body.senha || '';
        if (!email || !senha) {
          return res.status(400).json({ erro: 'Informe e-mail e senha.' });
        }
        const usuario = await prisma.usuario.findUnique({ where: { email } });
        if (!usuario || !verificarSenha(senha, usuario.senha)) {
          return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
        }
        await prisma.sessao.deleteMany({ where: { usuarioId: usuario.id } });
        const token = gerarToken();
        await prisma.sessao.create({ data: { token, usuarioId: usuario.id } });
        return res.json({
          token,
          usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
        });
      }

      if (action === 'logout') {
        const token = extrairToken(req);
        if (token) await prisma.sessao.deleteMany({ where: { token } });
        return res.json({ ok: true });
      }

      return res.status(400).json({ erro: 'Ação inválida.' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (err) {
    console.error('auth', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
}