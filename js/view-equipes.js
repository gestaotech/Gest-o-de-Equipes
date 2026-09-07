// ============================================================
// VIEW - Equipes
// ============================================================

registrarView('equipes', {
    titulo: 'Equipes',

    async render(container) {
        const equipes = await getEquipes();
        const projetos = await getProjetos();
        const pessoal = await getPessoal();

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
                                        ? e.membros.map(n => {
                                            const p = pessoal.find(x => x.nome === n);
                                            return `<span class="member-tag">${esc(n)}${p ? ` <span class="member-tag-info">${esc(p.cargo || p.funcao || p.departamento || '')}</span>` : ''}</span>`;
                                        }).join('')
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
        container.querySelector('#btn-nova-equipe').addEventListener('click', () => abrirModalEquipe(null, equipes, renderLista, pessoal));

        // Delegar ações
        listaDiv.addEventListener('click', async (e) => {
            const btnEdit = e.target.closest('[data-edit]');
            const btnDel = e.target.closest('[data-del]');

            if (btnEdit) {
                const equipe = equipes.find(x => x.id === btnEdit.dataset.edit);
                abrirModalEquipe(equipe, equipes, renderLista, pessoal);
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
function abrirModalEquipe(equipe, equipes, depois, pessoal = []) {
    const modal = criarModal(equipe ? 'Editar Equipe' : 'Nova Equipe');
    const membros = equipe ? [...(equipe.membros || [])] : [];

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
                <input type="text" id="eq-lider" list="eq-lider-list" value="${esc(equipe ? equipe.lider : '')}" placeholder="Escolha do Pessoal ou digite">
                <datalist id="eq-lider-list">
                    ${pessoal.map(p => `<option value="${esc(p.nome)}">`).join('')}
                </datalist>
            </div>
            <div class="form-group">
                <label>Descrição</label>
                <textarea id="eq-desc" rows="3">${esc(equipe ? equipe.descricao : '')}</textarea>
            </div>
            <div class="form-group">
                <label>Membros da equipe (do Pessoal)</label>
                <div class="modal-tags">
                    <div class="tag-list" id="eq-tags"></div>
                    <div class="tag-field">
                        <select id="eq-membro-select">
                            <option value="">Selecione do Pessoal...</option>
                        </select>
                        <input type="text" id="eq-membro" placeholder="ou digite um nome">
                        <button type="button" class="btn btn-tag-add" id="eq-add">+</button>
                    </div>
                    ${pessoal.length === 0 ? '<p class="muted tag-hint">Nenhum funcionário no Pessoal. Cadastre na aba <strong>Pessoal</strong> ou digite nomes manualmente.</p>' : ''}
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
        $tags.innerHTML = membros.map((m, i) => {
            const p = pessoal.find(x => x.nome === m);
            return `
                <span class="tag-item">${esc(m)}${p && p.departamento ? ` <em class="tag-item-info">${esc(p.departamento)}</em>` : ''}
                    <button type="button" class="tag-remove" data-i="${i}">&times;</button>
                </span>
            `;
        }).join('');
    }

    function renderMembrosSelect() {
        const $sel = modal.body.querySelector('#eq-membro-select');
        if (!$sel) return;
        const dep = modal.body.querySelector('#eq-dep').value;
        let disponiveis = pessoal.filter(p => !membros.includes(p.nome));
        if (dep) {
            const doDept = disponiveis.filter(p => p.departamento === dep);
            const outros = disponiveis.filter(p => p.departamento !== dep);
            disponiveis = doDept.concat(outros);
        }
        $sel.innerHTML = '<option value="">' + (disponiveis.length ? 'Selecionar do Pessoal...' : 'Nenhum funcionário disponível') + '</option>' +
            disponiveis.map(p => `<option value="${esc(p.nome)}">${esc(p.nome)} — ${esc(p.cargo || p.funcao || 'sem cargo')}${p.departamento ? ' (' + esc(p.departamento) + ')' : ''}</option>`).join('');
    }

    renderMembros();
    renderMembrosSelect();

    // Adiciona membro selecionado do Pessoal
    const $sel = modal.body.querySelector('#eq-membro-select');
    $sel.addEventListener('change', () => {
        const v = $sel.value;
        if (!v) return;
        if (membros.includes(v)) { toast('Membro já adicionado', 'erro'); return; }
        membros.push(v);
        // Sincroniza departamento: se a equipe não tem, herda o do funcionário
        const p = pessoal.find(x => x.nome === v);
        if (p && p.departamento) {
            const $dep = modal.body.querySelector('#eq-dep');
            if (!$dep.value) $dep.value = p.departamento;
        }
        $sel.value = '';
        renderMembros();
        renderMembrosSelect();
    });

    // Ao trocar o departamento, atualiza a lista de funcionários sugeridos
    modal.body.querySelector('#eq-dep').addEventListener('change', renderMembrosSelect);

    // Adicionar membro digitado
    const $input = modal.body.querySelector('#eq-membro');
    function addMembro() {
        const v = $input.value.trim();
        if (!v) return;
        if (membros.includes(v)) { toast('Membro já adicionado', 'erro'); return; }
        membros.push(v);
        $input.value = '';
        renderMembros();
        renderMembrosSelect();
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
            renderMembrosSelect();
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
