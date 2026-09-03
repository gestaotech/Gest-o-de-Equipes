// ============================================================
// VIEW - Equipes
// ============================================================

registrarView('equipes', {
    titulo: 'Equipes',

    async render(container) {
        const equipes = await getEquipes();
        const projetos = await getProjetos();

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'view-toolbar';
        toolbar.innerHTML = `
            <div class="search-box">
                <input type="text" id="busca-equipes" placeholder="Buscar equipes...">
            </div>
            <button class="btn btn-primary" id="btn-nova-equipe">+ Nova Equipe</button>
        `;
        container.appendChild(toolbar);

        const listaDiv = document.createElement('div');
        listaDiv.id = 'lista-equipes';
        container.appendChild(listaDiv);

        function renderLista(filtro = '') {
            const filtradas = buscar(equipes, filtro, ['nome', 'departamento', 'lider', 'descricao']);

            if (filtradas.length === 0) {
                listaDiv.innerHTML = `<p class="empty-state">${equipes.length === 0 ? 'Nenhuma equipe cadastrada.' : 'Nenhum resultado para a busca.'}</p>`;
                return;
            }

            listaDiv.innerHTML = `
                <div class="teams-grid">
                    ${filtradas.map(e => {
                        const projCount = projetos.filter(p => p.equipeId === e.id).length;
                        return `
                        <div class="team-card">
                            <div class="team-header">
                                <h3>${esc(e.nome)}</h3>
                                ${e.departamento ? `<span class="badge dept">${esc(e.departamento)}</span>` : ''}
                            </div>
                            ${e.descricao ? `<p class="team-desc">${esc(e.descricao)}</p>` : ''}
                            <div class="team-lider"><strong>Líder:</strong> ${esc(e.lider) || 'Não definido'}</div>
                            <div class="team-members">
                                <h4>Membros (${e.membros ? e.membros.length : 0})</h4>
                                <div class="member-tags">
                                    ${e.membros && e.membros.length > 0
                                        ? e.membros.map(n => `<span class="member-tag">${esc(n)}</span>`).join('')
                                        : '<span class="muted">Nenhum membro</span>'
                                    }
                                </div>
                            </div>
                            <div class="team-meta">
                                <span>📋 Projetos: <strong>${projCount}</strong></span>
                            </div>
                            <div class="team-actions">
                                <button class="btn btn-edit" data-edit="${e.id}">Editar</button>
                                <button class="btn btn-delete" data-del="${e.id}">Excluir</button>
                            </div>
                        </div>
                    `;}).join('')}
                </div>
            `;
        }

        renderLista();

        // Busca
        const busca = container.querySelector('#busca-equipes');
        busca.addEventListener('input', () => renderLista(busca.value));

        // Nova equipe
        container.querySelector('#btn-nova-equipe').addEventListener('click', () => abrirModalEquipe(null, equipes, renderLista));

        // Delegar ações
        listaDiv.addEventListener('click', async (e) => {
            const btnEdit = e.target.closest('[data-edit]');
            const btnDel = e.target.closest('[data-del]');

            if (btnEdit) {
                const equipe = equipes.find(x => x.id === btnEdit.dataset.edit);
                abrirModalEquipe(equipe, equipes, renderLista);
            }

            if (btnDel) {
                const id = btnDel.dataset.del;
                const equipe = equipes.find(x => x.id === id);
                if (confirm(`Excluir a equipe "${equipe && equipe.nome}"?`)) {
                    await excluirEquipe(id);
                    equipes.splice(equipes.findIndex(x => x.id === id), 1);
                    renderLista(busca.value);
                    toast('Equipe excluída!', 'erro');
                }
            }
        });
    }
});

// Abre o modal de criação/edição de equipe
function abrirModalEquipe(equipe, equipes, depois) {
    const modal = criarModal(equipe ? 'Editar Equipe' : 'Nova Equipe');
    const membros = equipe ? [...(equipe.membros || [])] : [];
    let novoMembro = '';

    modal.body.innerHTML = `
        <form id="form-equipe">
            <div class="form-group">
                <label>Nome da equipe *</label>
                <input type="text" id="eq-nome" required value="${esc(equipe ? equipe.nome : '')}">
            </div>
            <div class="form-group">
                <label>Departamento</label>
                <select id="eq-dep">
                    <option value="">Selecione...</option>
                    ${['Administrativo','Financeiro','Marketing','TI','RH','Comercial','Operações']
                        .map(d => `<option value="${d}" ${equipe && equipe.departamento === d ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Líder da equipe</label>
                <input type="text" id="eq-lider" value="${esc(equipe ? equipe.lider : '')}">
            </div>
            <div class="form-group">
                <label>Descrição</label>
                <textarea id="eq-desc" rows="3">${esc(equipe ? equipe.descricao : '')}</textarea>
            </div>
            <div class="form-group">
                <label>Membros da equipe</label>
                <div class="modal-tags">
                    <div class="tag-list" id="eq-tags"></div>
                    <div class="tag-field">
                        <input type="text" id="eq-membro" placeholder="Nome do membro">
                        <button type="button" class="btn btn-tag-add" id="eq-add">+</button>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button type="submit" class="btn btn-primary">${equipe ? 'Atualizar' : 'Salvar'}</button>
                <button type="button" class="btn btn-secondary" id="eq-cancel">Cancelar</button>
            </div>
        </form>
    `;

    function renderMembros() {
        const $tags = modal.body.querySelector('#eq-tags');
        $tags.innerHTML = membros.map((m, i) => `
            <span class="tag-item">${esc(m)} <button type="button" class="tag-remove" data-i="${i}">&times;</button></span>
        `).join('');
    }
    renderMembros();

    // Adicionar membro
    const $input = modal.body.querySelector('#eq-membro');
    function addMembro() {
        const v = $input.value.trim();
        if (!v) return;
        if (membros.includes(v)) { toast('Membro já adicionado', 'erro'); return; }
        membros.push(v);
        $input.value = '';
        renderMembros();
        $input.focus();
    }
    modal.body.querySelector('#eq-add').addEventListener('click', addMembro);
    $input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMembro(); } });

    // Remover membro (delegação)
    modal.body.querySelector('#eq-tags').addEventListener('click', (e) => {
        const btn = e.target.closest('.tag-remove');
        if (btn) {
            membros.splice(parseInt(btn.dataset.i), 1);
            renderMembros();
        }
    });

    modal.body.querySelector('#eq-cancel').addEventListener('click', modal.fechar);

    modal.body.querySelector('#form-equipe').addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = {
            nome: modal.body.querySelector('#eq-nome').value.trim(),
            departamento: modal.body.querySelector('#eq-dep').value,
            lider: modal.body.querySelector('#eq-lider').value.trim(),
            descricao: modal.body.querySelector('#eq-desc').value.trim(),
            membros: [...membros]
        };
        if (!dados.nome) { toast('Nome é obrigatório', 'erro'); return; }

        if (equipe) {
            const idx = equipes.findIndex(x => x.id === equipe.id);
            equipes[idx] = { ...equipe, ...dados };
            await salvarEquipe(equipes[idx]);
            toast('Equipe atualizada!');
        } else {
            const nova = await salvarEquipe(dados);
            equipes.push(nova);
            toast('Equipe criada!');
        }
        modal.fechar();
        if (depois) depois();
    });
}
