// ============================================================
// DATA - Regras de negócio para Equipes, Projetos, Tarefas
// Todos os dados são escopados por usuário
// ============================================================

function dataKey(type) {
    const uid = getCurrentUser().uid;
    return `user:${uid}:${type}`;
}

// Gera id único
function genId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

// ======================== EQUIPES ========================

async function getEquipes() {
    const data = await dbGet(dataKey('equipes'));
    return data || [];
}

async function salvarEquipe(equipe) {
    const equipes = await getEquipes();
    if (equipe.id) {
        const idx = equipes.findIndex(e => e.id === equipe.id);
        if (idx !== -1) equipes[idx] = equipe;
    } else {
        equipe.id = genId();
        equipe.criadoEm = new Date().toISOString();
        equipes.push(equipe);
    }
    await dbSet(dataKey('equipes'), equipes);
    return equipe;
}

async function excluirEquipe(id) {
    const equipes = await getEquipes();
    const nova = equipes.filter(e => e.id !== id);
    await dbSet(dataKey('equipes'), nova);
}

// ======================== PESSOAL ========================

async function getPessoal() {
    const data = await dbGet(dataKey('pessoal'));
    return data || [];
}

async function salvarPessoa(pessoa) {
    const pessoal = await getPessoal();
    if (pessoa.id) {
        const idx = pessoal.findIndex(p => p.id === pessoa.id);
        if (idx !== -1) pessoal[idx] = pessoa;
    } else {
        pessoa.id = genId();
        pessoa.criadoEm = new Date().toISOString();
        pessoal.push(pessoa);
    }
    await dbSet(dataKey('pessoal'), pessoal);
    return pessoa;
}

async function excluirPessoa(id) {
    const pessoal = await getPessoal();
    const nova = pessoal.filter(p => p.id !== id);
    await dbSet(dataKey('pessoal'), nova);
}

// ======================== PROJETOS ========================

async function getProjetos() {
    const data = await dbGet(dataKey('projetos'));
    return data || [];
}

async function salvarProjeto(projeto) {
    const projetos = await getProjetos();
    if (projeto.id) {
        const idx = projetos.findIndex(p => p.id === projeto.id);
        if (idx !== -1) projetos[idx] = projeto;
    } else {
        projeto.id = genId();
        projeto.criadoEm = new Date().toISOString();
        projetos.push(projeto);
    }
    await dbSet(dataKey('projetos'), projetos);
    return projeto;
}

async function excluirProjeto(id) {
    const projetos = await getProjetos();
    const nova = projetos.filter(p => p.id !== id);
    await dbSet(dataKey('projetos'), nova);

    // Remove tarefas e anexos vinculados ao projeto
    const tarefas = await getTarefas();
    const tarefasRemovidas = tarefas.filter(t => t.projetoId === id);
    const tarefasRestantes = tarefas.filter(t => t.projetoId !== id);
    await dbSet(dataKey('tarefas'), tarefasRestantes);

    // Remove anexos e comentários das tarefas excluídas
    for (const t of tarefasRemovidas) {
        await removerAnexosTarefa(t.id);
    }
}

// ======================== TAREFAS ========================

async function getTarefas() {
    const data = await dbGet(dataKey('tarefas'));
    return data || [];
}

async function getTarefa(id) {
    const tarefas = await getTarefas();
    return tarefas.find(t => t.id === id) || null;
}

async function salvarTarefa(tarefa) {
    const tarefas = await getTarefas();
    if (tarefa.id) {
        const idx = tarefas.findIndex(t => t.id === tarefa.id);
        if (idx !== -1) tarefas[idx] = tarefa;
    } else {
        tarefa.id = genId();
        tarefa.criadoEm = new Date().toISOString();
        tarefa.comentarios = tarefa.comentarios || [];
        tarefa.anexos = tarefa.anexos || [];
        tarefas.push(tarefa);
    }
    await dbSet(dataKey('tarefas'), tarefas);
    return tarefa;
}

async function excluirTarefa(id) {
    const tarefas = await getTarefas();
    const nova = tarefas.filter(t => t.id !== id);
    await dbSet(dataKey('tarefas'), nova);
    await removerAnexosTarefa(id);
}

async function atualizarStatusTarefa(id, status) {
    const tarefas = await getTarefas();
    const idx = tarefas.findIndex(t => t.id === id);
    if (idx !== -1) {
        tarefas[idx].status = status;
        tarefas[idx].atualizadoEm = new Date().toISOString();
        await dbSet(dataKey('tarefas'), tarefas);
    }
}

// ======================== COMENTÁRIOS ========================

async function adicionarComentario(tarefaId, texto) {
    const tarefas = await getTarefas();
    const idx = tarefas.findIndex(t => t.id === tarefaId);
    if (idx === -1) throw new Error('Tarefa não encontrada');

    const user = getCurrentUser();
    const comentario = {
        id: genId(),
        texto: texto.trim(),
        autor: user.nome,
        criadoEm: new Date().toISOString()
    };

    tarefas[idx].comentarios = tarefas[idx].comentarios || [];
    tarefas[idx].comentarios.push(comentario);

    await dbSet(dataKey('tarefas'), tarefas);
    return comentario;
}

async function excluirComentario(tarefaId, comentarioId) {
    const tarefas = await getTarefas();
    const idx = tarefas.findIndex(t => t.id === tarefaId);
    if (idx === -1) return;

    tarefas[idx].comentarios = (tarefas[idx].comentarios || []).filter(c => c.id !== comentarioId);
    await dbSet(dataKey('tarefas'), tarefas);
}

// ======================== ANEXOS ========================

function anexoKey(tarefaId, anexoId) {
    return `user:${getCurrentUser().uid}:anexo:${tarefaId}:${anexoId}`;
}

async function adicionarAnexo(tarefaId, arquivo) {
    const tarefas = await getTarefas();
    const idx = tarefas.findIndex(t => t.id === tarefaId);
    if (idx === -1) throw new Error('Tarefa não encontrada');

    const id = genId();
    const anexo = {
        id,
        nome: arquivo.name,
        tipo: arquivo.type || 'application/octet-stream',
        tamanho: arquivo.size,
        criadoEm: new Date().toISOString(),
        autor: getCurrentUser().nome
    };

    // Salva o Blob separadamente
    await dbSetBlob(anexoKey(tarefaId, id), arquivo);

    // Atualiza o registro da tarefa
    tarefas[idx].anexos = tarefas[idx].anexos || [];
    tarefas[idx].anexos.push(anexo);
    await dbSet(dataKey('tarefas'), tarefas);

    return anexo;
}

async function obterBlobAnexo(tarefaId, anexoId) {
    return dbGetBlob(anexoKey(tarefaId, anexoId));
}

async function excluirAnexo(tarefaId, anexoId) {
    const tarefas = await getTarefas();
    const idx = tarefas.findIndex(t => t.id === tarefaId);
    if (idx !== -1) {
        tarefas[idx].anexos = (tarefas[idx].anexos || []).filter(a => a.id !== anexoId);
        await dbSet(dataKey('tarefas'), tarefas);
    }
    await dbDeleteBlob(anexoKey(tarefaId, anexoId));
}

async function removerAnexosTarefa(tarefaId) {
    const tarefa = await getTarefa(tarefaId);
    if (!tarefa || !tarefa.anexos) return;
    for (const a of tarefa.anexos) {
        await dbDeleteBlob(anexoKey(tarefaId, a.id));
    }
}

// ======================== NOTIFICAÇÕES DE PRAZO ========================

// Retorna lista de tarefas/projetos com prazo próximo (3 dias) ou atrasado
async function getNotificacoes() {
    const tarefas = await getTarefas();
    const projetos = await getProjetos();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limiteProximo = new Date(hoje);
    limiteProximo.setDate(limiteProximo.getDate() + 3);

    const notificacoes = [];

    // Tarefas
    tarefas.forEach(t => {
        if (!t.prazo || t.status === 'concluido') return;
        const prazo = new Date(t.prazo + 'T00:00:00');
        if (isNaN(prazo)) return;
        if (prazo < hoje) {
            notificacoes.push({
                tipo: 'tarefa',
                severidade: 'atrasado',
                id: t.id,
                titulo: t.titulo,
                prazo: t.prazo,
                dias: Math.round((hoje - prazo) / 86400000)
            });
        } else if (prazo <= limiteProximo) {
            const dias = Math.round((prazo - hoje) / 86400000);
            notificacoes.push({
                tipo: 'tarefa',
                severidade: 'proximo',
                id: t.id,
                titulo: t.titulo,
                prazo: t.prazo,
                dias: dias === 0 ? 'hoje' : dias
            });
        }
    });

    // Projetos
    projetos.forEach(p => {
        if (!p.prazo || p.status === 'concluido') return;
        const prazo = new Date(p.prazo + 'T00:00:00');
        if (isNaN(prazo)) return;
        if (prazo < hoje) {
            notificacoes.push({
                tipo: 'projeto',
                severidade: 'atrasado',
                id: p.id,
                titulo: p.nome,
                prazo: p.prazo,
                dias: Math.round((hoje - prazo) / 86400000)
            });
        } else if (prazo <= limiteProximo) {
            const dias = Math.round((prazo - hoje) / 86400000);
            notificacoes.push({
                tipo: 'projeto',
                severidade: 'proximo',
                id: p.id,
                titulo: p.nome,
                prazo: p.prazo,
                dias: dias === 0 ? 'hoje' : dias
            });
        }
    });

    // Ordena: atrasados primeiro, depois próximos
    notificacoes.sort((a, b) => {
        if (a.severidade === b.severidade) return 0;
        return a.severidade === 'atrasado' ? -1 : 1;
    });

    return notificacoes;
}

// ======================== IMPORTAÇÃO / EXPORTAÇÃO ========================

async function exportarTudo() {
    const equipes = await getEquipes();
    const projetos = await getProjetos();
    const tarefas = await getTarefas();
    const pessoal = await getPessoal();

    return {
        versao: 1,
        exportadoEm: new Date().toISOString(),
        usuario: {
            nome: getCurrentUser().nome,
            email: getCurrentUser().email
        },
        equipes,
        projetos,
        tarefas,
        pessoal
    };
}

async function importarTudo(dados) {
    if (!dados || typeof dados !== 'object') {
        throw new Error('Arquivo inválido.');
    }
    if (!Array.isArray(dados.equipes) || !Array.isArray(dados.projetos) || !Array.isArray(dados.tarefas)) {
        throw new Error('Estrutura do arquivo inválida.');
    }
    await dbSet(dataKey('equipes'), dados.equipes);
    await dbSet(dataKey('projetos'), dados.projetos);
    await dbSet(dataKey('tarefas'), dados.tarefas);
    if (Array.isArray(dados.pessoal)) {
        await dbSet(dataKey('pessoal'), dados.pessoal);
    }
}
