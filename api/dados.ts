import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma, toIso, jsonBody } from './_db';
import { getUsuarioDaRequisicao } from './_auth';

type DadosBody = {
  equipes?: any[];
  pessoal?: any[];
  projetos?: any[];
  tarefas?: any[];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const usuario = await getUsuarioDaRequisicao(req);
    if (!usuario) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }

    if (req.method === 'GET') {
      const [equipes, pessoal, projetos, tarefas] = await Promise.all([
        prisma.equipe.findMany({ where: { usuarioId: usuario.id } }),
        prisma.pessoa.findMany({ where: { usuarioId: usuario.id } }),
        prisma.projeto.findMany({ where: { usuarioId: usuario.id } }),
        prisma.tarefa.findMany({
          where: { usuarioId: usuario.id },
          include: { comentarios: true, anexos: true }
        })
      ]);

      return res.json({
        usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
        equipes: equipes.map(e => ({
          id: e.id,
          nome: e.nome,
          departamento: e.departamento,
          lider: e.lider,
          descricao: e.descricao,
          membros: Array.isArray(e.membros) ? e.membros : [],
          criadoEm: toIso(e.criadoEm)
        })),
        pessoal: pessoal.map(p => ({
          id: p.id,
          nome: p.nome,
          cargo: p.cargo,
          funcao: p.funcao,
          departamento: p.departamento,
          email: p.email,
          telefone: p.telefone,
          criadoEm: toIso(p.criadoEm)
        })),
        projetos: projetos.map(p => ({
          id: p.id,
          nome: p.nome,
          cliente: p.cliente,
          equipeId: p.equipeId,
          prazo: p.prazo,
          status: p.status,
          descricao: p.descricao,
          criadoEm: toIso(p.criadoEm)
        })),
        tarefas: tarefas.map(t => ({
          id: t.id,
          titulo: t.titulo,
          projetoId: t.projetoId,
          responsavel: t.responsavel,
          status: t.status,
          prazo: t.prazo,
          descricao: t.descricao,
          criadoEm: toIso(t.criadoEm),
          atualizadoEm: toIso(t.atualizadoEm) || undefined,
          comentarios: (t.comentarios || []).map(c => ({
            id: c.id,
            texto: c.texto,
            autor: c.autor,
            criadoEm: toIso(c.criadoEm)
          })),
          anexos: (t.anexos || []).map(a => ({
            id: a.id,
            nome: a.nome,
            tipo: a.tipo,
            tamanho: a.tamanho,
            autor: a.autor,
            criadoEm: toIso(a.criadoEm),
            conteudo: a.conteudo ? Buffer.from(a.conteudo).toString('base64') : undefined
          }))
        }))
      });
    }

    if (req.method === 'PUT') {
      const dados = jsonBody<DadosBody>(req.body);
      const equipes = Array.isArray(dados.equipes) ? dados.equipes : [];
      const pessoal = Array.isArray(dados.pessoal) ? dados.pessoal : [];
      const projetos = Array.isArray(dados.projetos) ? dados.projetos : [];
      const tarefas = Array.isArray(dados.tarefas) ? dados.tarefas : [];

      await prisma.$transaction(async tx => {
        await tx.tarefa.deleteMany({ where: { usuarioId: usuario.id } });
        await tx.projeto.deleteMany({ where: { usuarioId: usuario.id } });
        await tx.equipe.deleteMany({ where: { usuarioId: usuario.id } });
        await tx.pessoa.deleteMany({ where: { usuarioId: usuario.id } });

        if (equipes.length) {
          await tx.equipe.createMany({
            data: equipes.map(e => ({
              id: String(e.id),
              usuarioId: usuario.id,
              nome: String(e.nome || ''),
              departamento: String(e.departamento || ''),
              lider: String(e.lider || ''),
              descricao: String(e.descricao || ''),
              membros: Array.isArray(e.membros) ? e.membros : [],
              criadoEm: e.criadoEm ? new Date(e.criadoEm) : new Date()
            }))
          });
        }

        if (pessoal.length) {
          await tx.pessoa.createMany({
            data: pessoal.map(p => ({
              id: String(p.id),
              usuarioId: usuario.id,
              nome: String(p.nome || ''),
              cargo: String(p.cargo || ''),
              funcao: String(p.funcao || ''),
              departamento: String(p.departamento || ''),
              email: String(p.email || ''),
              telefone: String(p.telefone || ''),
              criadoEm: p.criadoEm ? new Date(p.criadoEm) : new Date()
            }))
          });
        }

        if (projetos.length) {
          await tx.projeto.createMany({
            data: projetos.map(p => ({
              id: String(p.id),
              usuarioId: usuario.id,
              nome: String(p.nome || ''),
              cliente: String(p.cliente || ''),
              equipeId: String(p.equipeId || ''),
              prazo: String(p.prazo || ''),
              status: String(p.status || 'planejamento'),
              descricao: String(p.descricao || ''),
              criadoEm: p.criadoEm ? new Date(p.criadoEm) : new Date()
            }))
          });
        }

        if (tarefas.length) {
          await tx.tarefa.createMany({
            data: tarefas.map(t => ({
              id: String(t.id),
              usuarioId: usuario.id,
              titulo: String(t.titulo || ''),
              projetoId: String(t.projetoId || ''),
              responsavel: String(t.responsavel || ''),
              status: String(t.status || 'a_fazer'),
              prazo: String(t.prazo || ''),
              descricao: String(t.descricao || ''),
              criadoEm: t.criadoEm ? new Date(t.criadoEm) : new Date(),
              atualizadoEm: t.atualizadoEm ? new Date(t.atualizadoEm) : null
            }))
          });

          for (const t of tarefas) {
            const comentarios = Array.isArray(t.comentarios) ? t.comentarios : [];
            if (comentarios.length) {
              await tx.comentario.createMany({
                data: comentarios.map(c => ({
                  id: String(c.id),
                  tarefaId: String(t.id),
                  texto: String(c.texto || ''),
                  autor: String(c.autor || ''),
                  criadoEm: c.criadoEm ? new Date(c.criadoEm) : new Date()
                }))
              });
            }
            const anexos = Array.isArray(t.anexos) ? t.anexos : [];
            if (anexos.length) {
              await tx.anexo.createMany({
                data: anexos.map(a => ({
                  id: String(a.id),
                  tarefaId: String(t.id),
                  nome: String(a.nome || ''),
                  tipo: String(a.tipo || ''),
                  tamanho: Number(a.tamanho) || 0,
                  autor: String(a.autor || ''),
                  criadoEm: a.criadoEm ? new Date(a.criadoEm) : new Date(),
                  conteudo: a.conteudo ? Buffer.from(String(a.conteudo), 'base64') : null
                }))
              });
            }
          }
        }
      });

      return res.json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (err) {
    console.error('dados', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
}