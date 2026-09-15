// ============================================================
// VIEW - Pessoal
// ============================================================

registrarView('pessoal', {
    titulo: 'Pessoal',

    async render(container) {
        const pessoal = await getPessoal();

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'view-toolbar';
        toolbar.innerHTML = `
            <div class="search-box">
                <input type="text" id="busca-pessoal" placeholder="Buscar funcionários...">
            </div>
            <button class="btn btn-primary" id="btn-novo-pessoa">+ Novo Funcionário</button>
        `;
        container.appendChild(toolbar);

        const listaDiv = document.createElement('div');
        listaDiv.id = 'lista-pessoal';
        container.appendChild(listaDiv);

        function renderLista(filtro = '') {
            const filtradas = buscar(pessoal, filtro, ['nome', 'cargo', 'funcao', 'email', 'departamento']);

            if (filtradas.length === 0) {
                listaDiv.innerHTML = `<p class="empty-state">${pessoal.length === 0 ? 'Nenhum funcionário cadastrado.' : 'Nenhum resultado para a busca.'}</p>`;
                return;
            }

            listaDiv.innerHTML = `
                <div class="pessoal-grid">
                    ${filtradas.map(p => `
                        <div class="pessoa-card">
                            <div class="pessoa-avatar">${esc((p.nome || '?').trim().charAt(0).toUpperCase())}</div>
                            <div class="pessoa-body">
                                <div class="pessoa-header">
                                    <h3>${esc(p.nome)}</h3>
                                </div>
                                <div class="pessoa-badges">
                                    ${p.cargo ? `<span class="badge cargo">${esc(p.cargo)}</span>` : ''}
                                    ${p.funcao ? `<span class="badge funcao">${esc(p.funcao)}</span>` : ''}
                                </div>
                                ${p.departamento ? `<div class="pessoa-dep"><strong>Departamento:</strong> ${esc(p.departamento)}</div>` : ''}
                                ${p.email ? `<div class="pessoa-email">✉️ ${esc(p.email)}</div>` : ''}
                                ${p.telefone ? `<div class="pessoa-phone">📞 ${esc(p.telefone)}</div>` : ''}
                            </div>
                            <div class="pessoa-actions">
                                <button class="btn btn-edit" data-edit="${p.id}">Editar</button>
                                <button class="btn btn-delete" data-del="${p.id}">Excluir</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        renderLista();

        // Busca
        const busca = container.querySelector('#busca-pessoal') as HTMLInputElement;
        busca.addEventListener('input', () => renderLista(busca.value));

        // Novo funcionário
        container.querySelector('#btn-novo-pessoa')!.addEventListener('click', () => abrirModalPessoa(null, pessoal, renderLista));

        // Delegar ações
        listaDiv.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const btnEdit = target.closest('[data-edit]') as HTMLElement | null;
            const btnDel = target.closest('[data-del]') as HTMLElement | null;

            if (btnEdit) {
                const pessoa = pessoal.find(x => x.id === btnEdit!.dataset.edit);
                abrirModalPessoa(pessoa || null, pessoal, renderLista);
            }

            if (btnDel) {
                const id = btnDel!.dataset.del!;
                const pessoa = pessoal.find(x => x.id === id);
                if (confirm(`Excluir o funcionário "${pessoa && pessoa.nome}"?`)) {
                    await excluirPessoa(id);
                    pessoal.splice(pessoal.findIndex(x => x.id === id), 1);
                    renderLista(busca.value);
                    toast('Funcionário excluído!', 'erro');
                }
            }
        });
    }
});

// Abre o modal de criação/edição de funcionário
function abrirModalPessoa(pessoa: Pessoa | null, pessoal: Pessoa[], depois?: () => void): void {
    const modal = criarModal(pessoa ? 'Editar Funcionário' : 'Novo Funcionário');

    modal.body.innerHTML = `
        <form id="form-pessoa">
            <div class="form-group">
                <label>Nome completo *</label>
                <input type="text" id="ps-nome" required value="${esc(pessoa ? pessoa.nome : '')}" placeholder="Nome do funcionário">
            </div>
            <div class="form-group">
                <label>Cargo *</label>
                <input type="text" id="ps-cargo" required value="${esc(pessoa ? pessoa.cargo : '')}" placeholder="Ex: Analista, Coordenador, Gerente">
            </div>
            <div class="form-group">
                <label>Função</label>
                <input type="text" id="ps-funcao" value="${esc(pessoa ? pessoa.funcao : '')}" placeholder="Ex: Desenvolvimento, Suporte, Vendas">
            </div>
            <div class="form-group">
                <label>Departamento</label>
                <select id="ps-dep">
                    <option value="">Selecione...</option>
                    ${['Administrativo','Financeiro','Marketing','TI','RH','Comercial','Operações']
                        .map(d => `<option value="${d}" ${pessoa && pessoa.departamento === d ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>E-mail</label>
                    <input type="email" id="ps-email" value="${esc(pessoa ? pessoa.email : '')}" placeholder="email@empresa.com">
                </div>
                <div class="form-group">
                    <label>Telefone</label>
                    <input type="text" id="ps-telefone" value="${esc(pessoa ? pessoa.telefone : '')}" placeholder="(00) 00000-0000">
                </div>
            </div>
            <div class="modal-actions">
                <button type="submit" class="btn btn-primary">${pessoa ? 'Atualizar' : 'Salvar'}</button>
                <button type="button" class="btn btn-secondary" id="ps-cancel">Cancelar</button>
            </div>
        </form>
    `;

    (modal.body.querySelector('#ps-cancel') as HTMLButtonElement).addEventListener('click', modal.fechar);

    (modal.body.querySelector('#form-pessoa') as HTMLFormElement).addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados: Omit<Pessoa, 'id' | 'criadoEm'> = {
            nome: (modal.body.querySelector('#ps-nome') as HTMLInputElement).value.trim(),
            cargo: (modal.body.querySelector('#ps-cargo') as HTMLInputElement).value.trim(),
            funcao: (modal.body.querySelector('#ps-funcao') as HTMLInputElement).value.trim(),
            departamento: (modal.body.querySelector('#ps-dep') as HTMLSelectElement).value,
            email: (modal.body.querySelector('#ps-email') as HTMLInputElement).value.trim(),
            telefone: (modal.body.querySelector('#ps-telefone') as HTMLInputElement).value.trim()
        };
        if (!dados.nome) { toast('Nome é obrigatório', 'erro'); return; }
        if (!dados.cargo) { toast('Cargo é obrigatório', 'erro'); return; }

        if (pessoa) {
            const idx = pessoal.findIndex(x => x.id === pessoa.id);
            pessoal[idx] = { ...pessoa, ...dados };
            await salvarPessoa(pessoal[idx]);
            toast('Funcionário atualizado!');
        } else {
            const nova = await salvarPessoa(dados as any);
            pessoal.push(nova);
            toast('Funcionário adicionado!');
        }
        modal.fechar();
        if (depois) depois();
    });
}
