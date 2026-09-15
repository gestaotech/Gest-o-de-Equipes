// ============================================================
// DATA - Regras de negócio para Equipes, Projetos, Tarefas
// Persistência via API (Neon Postgres) com cache em memória
// ============================================================

interface DadosMemo {
    equipes: Equipe[];
    pessoal: Pessoa[];
    projetos: Projeto[];
    tarefas: Tarefa[];
}

let dadosMemo: DadosMemo | null = null;
let persisting: Promise<any> = Promise.resolve();

// Gera id único
function genId(): string {
    return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

function limparCacheDados(): void {
    dadosMemo = null;
}

// Carrega os dados do usuário (uma única vez) via API
async function carregarDados(force = false): Promise<void> {
    if (dadosMemo && !force) return;
    const d = await apiFetch('/api/dados');
    dadosMemo = {
        equipes: d.equipes || [],
        pessoal: d.pessoal || [],
        projetos: d.projetos || [],
        tarefas: d.tarefas || []
    };
}

// Envia o estado atual ao servidor (Postgres)
function persistirDados(): Promise<void> {
    if (!dadosMemo) return Promise.resolve();
    const payload = {
        equipes: dadosMemo.equipes,
        pessoal: dadosMemo.pessoal,
        projetos: dadosMemo.projetos,
        tarefas: dadosMemo.tarefas
    };
    persisting = persisting
        .catch(() => {})
        .then(() => apiFetch('/api/dados', { method: 'PUT', body: JSON.stringify(payload) }))
        .catch(err => {
            console.warn('Falha ao salvar dados no servidor:', err);
        });
    return persisting;
}

// ======================== EQUIPES ========================

async function getEquipes(): Promise<Equipe[]> {
    await carregarDados();
    return dadosMemo!.equipes;
}

async function salvarEquipe(equipe: Equipe): Promise<Equipe> {
    await carregarDados();
    const equipes = dadosMemo!.equipes;
    const idx = equipes.findIndex(e => e.id === equipe.id);
    if (idx !== -1) {
        equipes[idx] = equipe;
    } else {
        equipe.id = genId();
        equipe.criadoEm = new Date().toISOString();
        equipes.push(equipe);
    }
    await persistirDados();
    return equipe;
}

async function excluirEquipe(id: string): Promise<void> {
    await carregarDados();
    dadosMemo!.equipes = dadosMemo!.equipes.filter(e => e.id !== id);
    await persistirDados();
}

// ======================== PESSOAL ========================

async function getPessoal(): Promise<Pessoa[]> {
    await carregarDados();
    return dadosMemo!.pessoal;
}

async function salvarPessoa(pessoa: Pessoa): Promise<Pessoa> {
    await carregarDados();
    const pessoal = dadosMemo!.pessoal;
    const idx = pessoal.findIndex(p => p.id === pessoa.id);
    if (idx !== -1) {
        pessoal[idx] = pessoa;
    } else {
        pessoa.id = genId();
        pessoa.criadoEm = new Date().toISOString();
        pessoal.push(pessoa);
    }
    await persistirDados();
    return pessoa;
}

async function excluirPessoa(id: string): Promise<void> {
    await carregarDados();
    dadosMemo!.pessoal = dadosMemo!.pessoal.filter(p => p.id !== id);
    await persistirDados();
}

// ======================== PROJETOS ========================

async function getProjetos(): Promise<Projeto[]> {
    await carregarDados();
    return dadosMemo!.projetos;
}

async function salvarProjeto(projeto: Projeto): Promise<Projeto> {
    await carregarDados();
    const projetos = dadosMemo!.projetos;
    const idx = projetos.findIndex(p => p.id === projeto.id);
    if (idx !== -1) {
        projetos[idx] = projeto;
    } else {
        projeto.id = genId();
        projeto.criadoEm = new Date().toISOString();
        projetos.push(projeto);
    }
    await persistirDados();
    return projeto;
}

async function excluirProjeto(id: string): Promise<void> {
    await carregarDados();
    dadosMemo!.projetos = dadosMemo!.projetos.filter(p => p.id !== id);

    // Remove tarefas vinculadas ao projeto
    const tarefasRemovidas = dadosMemo!.tarefas.filter(t => t.projetoId === id);
    dadosMemo!.tarefas = dadosMemo!.tarefas.filter(t => t.projetoId !== id);

    // Remove anexos e comentários das tarefas excluídas (via API, o vínculo é removido junto)
    void tarefasRemovidas;
    await persistirDados();
}

// ======================== TAREFAS ========================

async function getTarefas(): Promise<Tarefa[]> {
    await carregarDados();
    return dadosMemo!.tarefas;
}

async function getTarefa(id: string): Promise<Tarefa | null> {
    await carregarDados();
    return dadosMemo!.tarefas.find(t => t.id === id) || null;
}

async function salvarTarefa(tarefa: Tarefa): Promise<Tarefa> {
    await carregarDados();
    const tarefas = dadosMemo!.tarefas;
    const idx = tarefas.findIndex(t => t.id === tarefa.id);
    if (idx !== -1) {
        tarefas[idx] = tarefa;
    } else {
        tarefa.id = genId();
        tarefa.criadoEm = new Date().toISOString();
        tarefa.comentarios = tarefa.comentarios || [];
        tarefa.anexos = tarefa.anexos || [];
        tarefas.push(tarefa);
    }
    await persistirDados();
    return tarefa;
}

async function excluirTarefa(id: string): Promise<void> {
    await carregarDados();
    dadosMemo!.tarefas = dadosMemo!.tarefas.filter(t => t.id !== id);
    await persistirDados();
}

async function atualizarStatusTarefa(id: string, status: string): Promise<void> {
    await carregarDados();
    const idx = dadosMemo!.tarefas.findIndex(t => t.id === id);
    if (idx !== -1) {
        dadosMemo!.tarefas[idx].status = status as StatusTarefa;
        dadosMemo!.tarefas[idx].atualizadoEm = new Date().toISOString();
        await persistirDados();
    }
}

// ======================== COMENTÁRIOS ========================

async function adicionarComentario(tarefaId: string, texto: string): Promise<Comentario> {
    await carregarDados();
    const tarefas = dadosMemo!.tarefas;
    const idx = tarefas.findIndex(t => t.id === tarefaId);
    if (idx === -1) throw new Error('Tarefa não encontrada');

    const user = getCurrentUser()!;
    const comentario: Comentario = {
        id: genId(),
        texto: texto.trim(),
        autor: user.nome,
        criadoEm: new Date().toISOString()
    };

    tarefas[idx].comentarios = tarefas[idx].comentarios || [];
    tarefas[idx].comentarios.push(comentario);

    await persistirDados();
    return comentario;
}

async function excluirComentario(tarefaId: string, comentarioId: string): Promise<void> {
    await carregarDados();
    const tarefas = dadosMemo!.tarefas;
    const idx = tarefas.findIndex(t => t.id === tarefaId);
    if (idx === -1) return;

    tarefas[idx].comentarios = (tarefas[idx].comentarios || []).filter(c => c.id !== comentarioId);
    await persistirDados();
}

// ======================== ANEXOS ========================

function arquivoParaBase64(arquivo: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            resolve(result.split(',')[1] || result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(arquivo);
    });
}

async function adicionarAnexo(tarefaId: string, arquivo: File): Promise<Anexo> {
    await carregarDados();
    const tarefas = dadosMemo!.tarefas;
    const idx = tarefas.findIndex(t => t.id === tarefaId);
    if (idx === -1) throw new Error('Tarefa não encontrada');

    const anexo: Anexo = {
        id: genId(),
        nome: arquivo.name,
        tipo: arquivo.type || 'application/octet-stream',
        tamanho: arquivo.size,
        criadoEm: new Date().toISOString(),
        autor: getCurrentUser()!.nome,
        conteudo: await arquivoParaBase64(arquivo)
    };

    tarefas[idx].anexos = tarefas[idx].anexos || [];
    tarefas[idx].anexos.push(anexo);
    await persistirDados();
    return anexo;
}

async function obterBlobAnexo(tarefaId: string, anexoId: string): Promise<Blob | undefined> {
    await carregarDados();
    const tarefa = dadosMemo!.tarefas.find(t => t.id === tarefaId);
    const anexo = tarefa && tarefa.anexos ? tarefa.anexos.find(a => a.id === anexoId) : undefined;
    if (!anexo || !anexo.conteudo) return undefined;

    const bin = atob(anexo.conteudo);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: anexo.tipo || 'application/octet-stream' });
}

async function excluirAnexo(tarefaId: string, anexoId: string): Promise<void> {
    await carregarDados();
    const tarefas = dadosMemo!.tarefas;
    const idx = tarefas.findIndex(t => t.id === tarefaId);
    if (idx !== -1) {
        tarefas[idx].anexos = (tarefas[idx].anexos || []).filter(a => a.id !== anexoId);
        await persistirDados();
    }
}

// ======================== NOTIFICAÇÕES DE PRAZO ========================

// Retorna lista de tarefas/projetos com prazo próximo (3 dias) ou atrasado
async function getNotificacoes(): Promise<Notificacao[]> {
    const tarefas = await getTarefas();
    const projetos = await getProjetos();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limiteProximo = new Date(hoje);
    limiteProximo.setDate(limiteProximo.getDate() + 3);

    const notificacoes: Notificacao[] = [];

    // Tarefas
    tarefas.forEach(t => {
        if (!t.prazo || t.status === 'concluido') return;
        const prazo = new Date(t.prazo + 'T00:00:00');
        if (isNaN(prazo.getTime())) return;
        if (prazo < hoje) {
            notificacoes.push({
                tipo: 'tarefa',
                severidade: 'atrasado',
                id: t.id,
                titulo: t.titulo,
                prazo: t.prazo,
                dias: Math.round((hoje.getTime() - prazo.getTime()) / 86400000)
            });
        } else if (prazo <= limiteProximo) {
            const dias = Math.round((prazo.getTime() - hoje.getTime()) / 86400000);
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
        if (isNaN(prazo.getTime())) return;
        if (prazo < hoje) {
            notificacoes.push({
                tipo: 'projeto',
                severidade: 'atrasado',
                id: p.id,
                titulo: p.nome,
                prazo: p.prazo,
                dias: Math.round((hoje.getTime() - prazo.getTime()) / 86400000)
            });
        } else if (prazo <= limiteProximo) {
            const dias = Math.round((prazo.getTime() - hoje.getTime()) / 86400000);
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

async function exportarTudo(): Promise<BackdadoExport> {
    const equipes = await getEquipes();
    const projetos = await getProjetos();
    const tarefas = await getTarefas();
    const pessoal = await getPessoal();
    const user = getCurrentUser()!;

    return {
        versao: 1,
        exportadoEm: new Date().toISOString(),
        usuario: {
            nome: user.nome,
            email: user.email
        },
        equipes,
        projetos,
        tarefas,
        pessoal
    };
}

async function importarTudo(dados: any): Promise<void> {
    if (!dados || typeof dados !== 'object') {
        throw new Error('Arquivo inválido.');
    }
    if (!Array.isArray(dados.equipes) || !Array.isArray(dados.projetos) || !Array.isArray(dados.tarefas)) {
        throw new Error('Estrutura do arquivo inválida.');
    }
    await carregarDados();
    dadosMemo!.equipes = dados.equipes;
    dadosMemo!.projetos = dados.projetos;
    dadosMemo!.tarefas = dados.tarefas;
    dadosMemo!.pessoal = Array.isArray(dados.pessoal) ? dados.pessoal : [];
    await persistirDados();
}

// ======================== MIGRAÇÃO (IndexedDB → Postgres) ========================

// Move os dados locais (IndexedDB) para o usuário recém-cadastrado no Postgres
async function migrarDadosLocais(): Promise<void> {
    try {
        await openDB();
        const keys = await dbKeys('user:');

        // Encontra o uid local com mais dados
        const porUid: Record<string, { equipes: number; pessoal: number; projetos: number; tarefas: number }> = {};
        keys.forEach(k => {
            const m = k.match(/^user:([^:]+):(equipes|pessoal|projetos|tarefas)$/);
            if (!m) return;
            if (!porUid[m[1]]) porUid[m[1]] = { equipes: 0, pessoal: 0, projetos: 0, tarefas: 0 };
        });

        if (keys.length === 0) return;

        // Identifica uids que possuem coleções
        const uidsComDados: string[] = Object.keys(porUid);
        if (!uidsComDados.length) return;

        for (let n = 0; n < uidsComDados.length; n++) {
            const uid = uidsComDados[n];
            const equipes: Equipe[] = (await dbGet(`user:${uid}:equipes`)) || [];
            const pessoal: Pessoa[] = (await dbGet(`user:${uid}:pessoal`)) || [];
            const projetos: Projeto[] = (await dbGet(`user:${uid}:projetos`)) || [];
            const tarefas: Tarefa[] = (await dbGet(`user:${uid}:tarefas`)) || [];

            const temDados = equipes.length || pessoal.length || projetos.length || tarefas.length;
            if (!temDados) continue;

            // Carrega blobs de anexos
            for (const t of tarefas) {
                for (const a of t.anexos || []) {
                    const blob = await dbGetBlob(`user:${uid}:anexo:${t.id}:${a.id}`);
                    if (blob) {
                        a.conteudo = await arquivoParaBase64(blob);
                    }
                }
            }

            // O servidor só deve ser preenchido se ainda estiver vazio
            await carregarDados();
            const totalServidor = (dadosMemo!.equipes.length + dadosMemo!.pessoal.length + dadosMemo!.projetos.length + dadosMemo!.tarefas.length);
            const totalLocal = equipes.length + pessoal.length + projetos.length + tarefas.length;
            if (totalServidor >= totalLocal) return;

            dadosMemo = { equipes, pessoal, projetos, tarefas };
            await persistirDados();
            return;
        }
    } catch (err) {
        console.warn('Migração de dados locais não executada:', err);
    }
}