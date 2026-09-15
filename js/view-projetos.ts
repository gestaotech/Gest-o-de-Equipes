// ============================================================
// VIEW - Projetos
// ============================================================

registrarView('projetos', {
    titulo: 'Projetos',

    async render(container) {
        const projetos = await getProjetos();
        const equipes = await getEquipes();
        const tarefas = await getTarefas();

        function nomeEquipe(id) {
            const e = equipes.find(x => x.id === id);
            return e ? e.nome : '';
        }

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'view-toolbar';
        toolbar.innerHTML = `
            <div class="search-box">
                <input type="text" id="busca-projetos" placeholder="Buscar projetos...">
            </div>
            <select id="filtro-status" class="filtro">
                <option value="">Todos os status</option>
                <option value="planejamento">Planejamento</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
                <option value="pausado">Pausado</option>
            </select>
            <button class="btn btn-primary" id="btn-novo-projeto">+ Novo Projeto</button>
        `;
        container.appendChild(toolbar);

        const listaDiv = document.createElement('div');
        listaDiv.id = 'lista-projetos';
        container.appendChild(listaDiv);

        function renderLista() {
            const busca = (container.querySelector('#busca-projetos') as HTMLInputElement).value;
            const status = (container.querySelector('#filtro-status') as HTMLSelectElement).value;

            let filtradas = buscar(projetos, busca, ['nome', 'cliente', 'descricao']);
            if (status) filtradas = filtradas.filter(p => p.status === status);

            if (filtradas.length === 0) {
                listaDiv.innerHTML = `<p class="empty-state">${projetos.length === 0 ? 'Nenhum projeto criado.' : 'Nenhum resultado para a busca.'}</p>`;
                return;
            }

            listaDiv.innerHTML = `
                <div class="projetos-grid">
                    ${filtradas.map(p => {
                        const tafProj = tarefas.filter(t => t.projetoId === p.id);
                        const feitas = tafProj.filter(t => t.status === 'concluido').length;
                        const progresso = tafProj.length ? Math.round(feitas / tafProj.length * 100) : 0;
                        return `
                        <div class="projeto-card">
                            <div class="projeto-header">
                                <h3>${esc(p.nome)}</h3>
                                <span class="badge ${p.status}">${rotuloStatus(p.status)}</span>
                            </div>
                            ${p.descricao ? `<p class="team-desc">${esc(p.descricao)}</p>` : ''}
                            <div class="projeto-meta">
                                ${p.equipeId ? `<span class="meta-item">👥 ${esc(nomeEquipe(p.equipeId))}</span>` : ''}
                                ${p.prazo ? `<span class="meta-item">📅 ${fmtData(p.prazo)}</span>` : ''}
                            </div>
                            <div class="projeto-progresso">
                                <div class="progress-label">
                                    <span>Progresso</span><strong>${progresso}%</strong>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width:${progresso}%"></div>
                                </div>
                            </div>
                            <div class="team-meta">
                                <span>✅ ${feitas}/${tafProj.length} tarefas concluídas</span>
                            </div>
                            <div class="team-actions">
                                <a class="btn btn-primary btn-sm" href="#" data-view="tarefas" data-projeto="${p.id}">Gerenciar Tarefas</a>
                                <button class="btn btn-edit" data-edit="${p.id}">Editar</button>
                                <button class="btn btn-delete" data-del="${p.id}">Excluir</button>
                            </div>
                        </div>
                    `;}).join('')}
                </div>
            `;
        }

        renderLista();

        container.querySelector('#busca-projetos').addEventListener('input', renderLista);
        container.querySelector('#filtro-status').addEventListener('change', renderLista);
        container.querySelector('#btn-novo-projeto').addEventListener('click', () => abrirModalProjeto(null, projetos, equipes, renderLista));

        listaDiv.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const btnEdit = target.closest('[data-edit]') as HTMLElement | null;
            const btnDel = target.closest('[data-del]') as HTMLElement | null;
            const linkTarefas = target.closest('[data-view="tarefas"]') as HTMLElement | null;

            if (btnEdit) {
                const p = projetos.find(x => x.id === btnEdit!.dataset.edit);
                abrirModalProjeto(p || null, projetos, equipes, renderLista);
            }

            if (btnDel) {
                const id = btnDel!.dataset.del!;
                const p = projetos.find(x => x.id === id);
                if (confirm(`Excluir o projeto "${p && p.nome}"? As tarefas vinculadas também serão excluídas.`)) {
                    excluirProjeto(id).then(() => {
                        projetos.splice(projetos.findIndex(x => x.id === id), 1);
                        renderLista();
                        toast('Projeto excluído!', 'erro');
                    });
                }
            }

            if (linkTarefas) {
                e.preventDefault();
                e.stopPropagation();
                // Abre a view de tarefas filtrada pelo projeto
                sessao.projetoCtx = linkTarefas.dataset.projeto || null;
                navegarPara('tarefas');
            }
        });
    }
});

// Abre o modal de criação/edição de projeto
function abrirModalProjeto(projeto: Projeto | null, projetos: Projeto[], equipes: Equipe[], depois?: () => void): void {
    const modal = criarModal(projeto ? 'Editar Projeto' : 'Novo Projeto');

    const departamentos = [...new Set(equipes.map(e => e.departamento).filter(Boolean))];

    modal.body.innerHTML = `
        <form id="form-projeto">
            <div class="form-group">
                <label>Nome do projeto *</label>
                <input type="text" id="pr-nome" required value="${esc(projeto ? projeto.nome : '')}">
            </div>
            <div class="form-group">
                <label>Cliente / Departamento</label>
                <input type="text" id="pr-cliente" value="${esc(projeto ? projeto.cliente : '')}" placeholder="Departamento ou cliente">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Equipe vinculada</label>
                    <select id="pr-equipe">
                        <option value="">Nenhuma</option>
                        ${equipes.map(e => `<option value="${e.id}" ${projeto && projeto.equipeId === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Prazo</label>
                    <input type="date" id="pr-prazo" value="${esc(projeto && projeto.prazo ? projeto.prazo.slice(0,10) : '')}">
                </div>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="pr-status">
                    <option value="planejamento" ${projeto && projeto.status === 'planejamento' ? 'selected' : ''}>Planejamento</option>
                    <option value="em_andamento" ${projeto && projeto.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
                    <option value="pausado" ${projeto && projeto.status === 'pausado' ? 'selected' : ''}>Pausado</option>
                    <option value="concluido" ${projeto && projeto.status === 'concluido' ? 'selected' : ''}>Concluído</option>
                </select>
            </div>
            <div class="form-group">
                <label>Descrição</label>
                <textarea id="pr-desc" rows="3">${esc(projeto ? projeto.descricao : '')}</textarea>
            </div>
            <div class="modal-actions">
                <button type="submit" class="btn btn-primary">${projeto ? 'Atualizar' : 'Salvar'}</button>
                <button type="button" class="btn btn-secondary" id="pr-cancel">Cancelar</button>
            </div>
        </form>
    `;

    (modal.body.querySelector('#pr-cancel') as HTMLButtonElement).addEventListener('click', modal.fechar);

    (modal.body.querySelector('#form-projeto') as HTMLFormElement).addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados: Omit<Projeto, 'id' | 'criadoEm'> = {
            nome: (modal.body.querySelector('#pr-nome') as HTMLInputElement).value.trim(),
            cliente: (modal.body.querySelector('#pr-cliente') as HTMLInputElement).value.trim(),
            equipeId: (modal.body.querySelector('#pr-equipe') as HTMLSelectElement).value,
            prazo: (modal.body.querySelector('#pr-prazo') as HTMLInputElement).value,
            status: (modal.body.querySelector('#pr-status') as HTMLSelectElement).value as StatusProjeto,
            descricao: (modal.body.querySelector('#pr-desc') as HTMLTextAreaElement).value.trim()
        };
        if (!dados.nome) { toast('Nome é obrigatório', 'erro'); return; }

        if (projeto) {
            const idx = projetos.findIndex(x => x.id === projeto.id);
            projetos[idx] = { ...projeto, ...dados };
            await salvarProjeto(projetos[idx]);
            toast('Projeto atualizado!');
        } else {
            const novo = await salvarProjeto(dados as any);
            projetos.push(novo);
            toast('Projeto criado!');
        }
        modal.fechar();
        if (depois) depois();
    });
}
