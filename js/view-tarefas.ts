// ============================================================
// VIEW - Tarefas (com modal detalhado + comentários + anexos)
// ============================================================

registrarView('tarefas', {
    titulo: 'Tarefas',

    async render(container) {
        let tarefas = await getTarefas();
        const projetos = await getProjetos();
        const equipes = await getEquipes();

        const filtroProjeto = sessao.projetoCtx;

        // Coleta nomes de membros disponíveis
        const nomesDisponiveis = [];
        equipes.forEach(e => {
            if (e.lider && !nomesDisponiveis.includes(e.lider)) nomesDisponiveis.push(e.lider);
            (e.membros || []).forEach(m => { if (!nomesDisponiveis.includes(m)) nomesDisponiveis.push(m); });
        });

        function nomeProjeto(id) {
            const p = projetos.find(x => x.id === id);
            return p ? p.nome : '';
        }

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'view-toolbar';
        toolbar.innerHTML = `
            <div class="search-box">
                <input type="text" id="busca-tarefas" placeholder="Buscar tarefas...">
            </div>
            <select id="filtro-projeto" class="filtro">
                <option value="">Todos os projetos</option>
                ${projetos.map(p => `<option value="${p.id}" ${filtroProjeto === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
            </select>
            <select id="filtro-tarefa-status" class="filtro">
                <option value="">Todos os status</option>
                <option value="a_fazer">A fazer</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
            </select>
            <button class="btn btn-primary" id="btn-nova-tarefa">+ Nova Tarefa</button>
        `;
        container.appendChild(toolbar);

        const listaDiv = document.createElement('div');
        listaDiv.id = 'lista-tarefas';
        container.appendChild(listaDiv);

        if (filtroProjeto) {
            (container.querySelector('#filtro-projeto') as HTMLSelectElement).value = filtroProjeto;
        }

        function renderLista() {
            const busca = (container.querySelector('#busca-tarefas') as HTMLInputElement).value;
            const proj = (container.querySelector('#filtro-projeto') as HTMLSelectElement).value;
            const st = (container.querySelector('#filtro-tarefa-status') as HTMLSelectElement).value;

            let filtradas = buscar(tarefas, busca, ['titulo', 'descricao', 'responsavel']);
            if (proj) filtradas = filtradas.filter(t => t.projetoId === proj);
            if (st) filtradas = filtradas.filter(t => t.status === st);

            if (filtradas.length === 0) {
                listaDiv.innerHTML = `<p class="empty-state">${tarefas.length === 0 ? 'Nenhuma tarefa criada.' : 'Nenhum resultado para a busca.'}</p>`;
                return;
            }

            const grupos = [
                { status: 'a_fazer', titulo: 'A fazer', itens: [] },
                { status: 'em_andamento', titulo: 'Em andamento', itens: [] },
                { status: 'concluido', titulo: 'Concluído', itens: [] }
            ];
            filtradas.forEach(t => {
                const g = grupos.find(x => x.status === t.status) || grupos[0];
                g.itens.push(t);
            });

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            listaDiv.innerHTML = `
                <div class="kanban">
                    ${grupos.map(g => `
                        <div class="kanban-col" data-status="${g.status}">
                            <div class="kanban-head">
                                <span class="badge ${g.status}">${g.titulo}</span>
                                <span class="kanban-count">${g.itens.length}</span>
                            </div>
                            <div class="kanban-list">
                                ${g.itens.length === 0
                                    ? '<div class="kanban-empty">Sem tarefas</div>'
                                    : g.itens.map(t => {
                                        const comentarios = t.comentarios ? t.comentarios.length : 0;
                                        const anexos = t.anexos ? t.anexos.length : 0;
                                        let atrasoBadge = '';
                                        if (t.prazo && t.status !== 'concluido') {
                                            const prazo = new Date(t.prazo + 'T00:00:00');
                                            if (!isNaN(prazo.getTime()) && prazo.getTime() < hoje.getTime()) {
                                                atrasoBadge = '<span class="badge-atrasado">⚠ Atrasada</span>';
                                            } else if (!isNaN(prazo.getTime()) && prazo.getTime() - hoje.getTime() < 3 * 86400000) {
                                                atrasoBadge = '<span class="badge-proximo">⏰ Próx.</span>';
                                            }
                                        }
                                        return `
                                        <div class="kanban-card" data-id="${t.id}">
                                            <div class="kanban-card-title">${esc(t.titulo)} ${atrasoBadge}</div>
                                            ${t.descricao ? `<p class="kanban-card-desc">${esc(t.descricao)}</p>` : ''}
                                            <div class="kanban-card-meta">
                                                <span class="meta-item">${esc(nomeProjeto(t.projetoId)) || '—'}</span>
                                                <span class="meta-item">📅 ${fmtData(t.prazo)}</span>
                                            </div>
                                            ${t.responsavel ? `<div class="kanban-responsavel">👤 ${esc(t.responsavel)}</div>` : ''}
                                            <div class="kanban-card-stats">
                                                <span>💬 ${comentarios}</span>
                                                <span>📎 ${anexos}</span>
                                            </div>
                                            <div class="kanban-card-actions">
                                                <button class="btn btn-primary btn-sm" data-abrir="${t.id}">Abrir</button>
                                                ${t.status !== 'concluido' ? `<button class="btn btn-concluir btn-sm" data-move="${t.id}" data-to="concluido">✓</button>` : ''}
                                                <button class="btn btn-delete btn-sm" data-del="${t.id}">×</button>
                                            </div>
                                        </div>
                                    `}).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        renderLista();

        (container.querySelector('#busca-tarefas') as HTMLInputElement).addEventListener('input', renderLista);
        (container.querySelector('#filtro-projeto') as HTMLSelectElement).addEventListener('change', renderLista);
        (container.querySelector('#filtro-tarefa-status') as HTMLSelectElement).addEventListener('change', renderLista);
        container.querySelector('#btn-nova-tarefa')!.addEventListener('click', () => abrirModalTarefa(null, tarefas, projetos, nomesDisponiveis, renderLista));

        listaDiv.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const btnAbrir = target.closest('[data-abrir]') as HTMLElement | null;
            const btnEdit = target.closest('[data-edit]') as HTMLElement | null;
            const btnDel = target.closest('[data-del]') as HTMLElement | null;
            const btnMove = target.closest('[data-move]') as HTMLElement | null;

            if (btnAbrir) {
                abrirModalDetalhes(btnAbrir.dataset.abrir!, tarefas, projetos, nomesDisponiveis, () => {
                    renderLista();
                    atualizarIndicadorNotificacoes();
                });
            }

            if (btnEdit) {
                const t = tarefas.find(x => x.id === btnEdit!.dataset.edit);
                abrirModalTarefa(t || null, tarefas, projetos, nomesDisponiveis, renderLista);
            }

            if (btnDel) {
                const id = btnDel!.dataset.del!;
                if (confirm('Excluir esta tarefa? Comentários e anexos também serão removidos.')) {
                    await excluirTarefa(id);
                    tarefas.splice(tarefas.findIndex(x => x.id === id), 1);
                    renderLista();
                    atualizarIndicadorNotificacoes();
                    toast('Tarefa excluída!', 'erro');
                }
            }

            if (btnMove) {
                const id = btnMove!.dataset.move!;
                const to = btnMove!.dataset.to!;
                await atualizarStatusTarefa(id, to);
                const t = tarefas.find(x => x.id === id);
                if (t) t.status = to as StatusTarefa;
                renderLista();
            }
        });

        if (!filtroProjeto) sessao.projetoCtx = null;
    }
});

// ============================================================
// MODAL DE EDIÇÃO RÁPIDA (CRUD simples)
// ============================================================

function abrirModalTarefa(tarefa: Tarefa | null, tarefas: Tarefa[], projetos: Projeto[], nomesDisponiveis: string[], depois?: () => void): void {
    const modal = criarModal(tarefa ? 'Editar Tarefa' : 'Nova Tarefa');

    modal.body.innerHTML = `
        <form id="form-tarefa">
            <div class="form-group">
                <label>Título *</label>
                <input type="text" id="tf-titulo" required value="${esc(tarefa ? tarefa.titulo : '')}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Projeto</label>
                    <select id="tf-projeto">
                        <option value="">Nenhum</option>
                        ${projetos.map(p => `<option value="${p.id}" ${tarefa && tarefa.projetoId === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Responsável</label>
                    <input type="text" id="tf-responsavel" list="lista-nomes" value="${esc(tarefa ? tarefa.responsavel : '')}">
                    <datalist id="lista-nomes">
                        ${nomesDisponiveis.map(n => `<option value="${esc(n)}">`).join('')}
                    </datalist>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Status</label>
                    <select id="tf-status">
                        <option value="a_fazer" ${tarefa && tarefa.status === 'a_fazer' ? 'selected' : ''}>A fazer</option>
                        <option value="em_andamento" ${tarefa && tarefa.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
                        <option value="concluido" ${tarefa && tarefa.status === 'concluido' ? 'selected' : ''}>Concluído</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Prazo</label>
                    <input type="date" id="tf-prazo" value="${esc(tarefa && tarefa.prazo ? tarefa.prazo.slice(0,10) : '')}">
                </div>
            </div>
            <div class="form-group">
                <label>Descrição</label>
                <textarea id="tf-desc" rows="3">${esc(tarefa ? tarefa.descricao : '')}</textarea>
            </div>
            <div class="modal-actions">
                <button type="submit" class="btn btn-primary">${tarefa ? 'Atualizar' : 'Salvar'}</button>
                <button type="button" class="btn btn-secondary" id="tf-cancel">Cancelar</button>
            </div>
        </form>
    `;

    (modal.body.querySelector('#tf-cancel') as HTMLButtonElement).addEventListener('click', modal.fechar);

    (modal.body.querySelector('#form-tarefa') as HTMLFormElement).addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados: Omit<Tarefa, 'id' | 'criadoEm' | 'comentarios' | 'anexos'> = {
            titulo: (modal.body.querySelector('#tf-titulo') as HTMLInputElement).value.trim(),
            projetoId: (modal.body.querySelector('#tf-projeto') as HTMLSelectElement).value,
            responsavel: (modal.body.querySelector('#tf-responsavel') as HTMLInputElement).value.trim(),
            status: (modal.body.querySelector('#tf-status') as HTMLSelectElement).value as StatusTarefa,
            prazo: (modal.body.querySelector('#tf-prazo') as HTMLInputElement).value,
            descricao: (modal.body.querySelector('#tf-desc') as HTMLTextAreaElement).value.trim()
        };
        if (!dados.titulo) { toast('Título é obrigatório', 'erro'); return; }

        if (tarefa) {
            const idx = tarefas.findIndex(x => x.id === tarefa.id);
            tarefas[idx] = { ...tarefa, ...dados };
            await salvarTarefa(tarefas[idx]);
            toast('Tarefa atualizada!');
        } else {
            const nova = await salvarTarefa(dados as any);
            tarefas.push(nova);
            toast('Tarefa criada!');
        }
        modal.fechar();
        if (depois) depois();
    });
}

// ============================================================
// MODAL DE DETALHES (abas: Detalhes / Comentários / Anexos)
// ============================================================

async function abrirModalDetalhes(tarefaId: string, tarefas: Tarefa[], projetos: Projeto[], nomesDisponiveis: string[], depois?: () => void): Promise<void> {
    let tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa) return;

    const modal = criarModal('Tarefa', { largo: true });
    const user = getCurrentUser();

    function nomeProjeto(id) {
        const p = projetos.find(x => x.id === id);
        return p ? p.nome : '';
    }

    function renderAbaDetalhes() {
        return `
            <div class="detalhes-grid">
                <div>
                    <h4>${esc(tarefa.titulo)}</h4>
                    <div class="detalhes-meta">
                        <span class="badge ${tarefa.status}">${rotuloStatus(tarefa.status)}</span>
                        ${tarefa.responsavel ? `<span class="meta-item">👤 ${esc(tarefa.responsavel)}</span>` : ''}
                        ${tarefa.prazo ? `<span class="meta-item">📅 ${fmtData(tarefa.prazo)}</span>` : ''}
                        ${tarefa.projetoId ? `<span class="meta-item">📋 ${esc(nomeProjeto(tarefa.projetoId))}</span>` : ''}
                    </div>
                    ${tarefa.descricao ? `<p class="detalhes-desc">${esc(tarefa.descricao)}</p>` : '<p class="muted">Sem descrição.</p>'}
                </div>
            </div>
        `;
    }

    function renderAbaComentarios() {
        const comentarios = tarefa.comentarios || [];
        return `
            <div class="comentarios-lista" id="comentarios-lista">
                ${comentarios.length === 0
                    ? '<p class="muted">Nenhum comentário ainda.</p>'
                    : comentarios.map(c => `
                        <div class="comentario">
                            <div class="comentario-avatar">${esc((c.autor || '?').charAt(0).toUpperCase())}</div>
                            <div class="comentario-corpo">
                                <div class="comentario-head">
                                    <strong>${esc(c.autor)}</strong>
                                    <span>${fmtDataHora(c.criadoEm)}</span>
                                </div>
                                <p>${esc(c.texto)}</p>
                            </div>
                            ${c.autor === user.nome ? `<button class="btn-icon" data-del-coment="${c.id}" title="Excluir">×</button>` : ''}
                        </div>
                    `).join('')}
            </div>
            <div class="comentario-form">
                <textarea id="novo-comentario" rows="2" placeholder="Escreva um comentário..."></textarea>
                <button class="btn btn-primary" id="btn-add-comentario">Comentar</button>
            </div>
        `;
    }

    function renderAbaAnexos() {
        const anexos = tarefa.anexos || [];
        return `
            <div class="anexos-lista" id="anexos-lista">
                ${anexos.length === 0
                    ? '<p class="muted">Nenhum anexo ainda.</p>'
                    : '<div class="anexos-grid">' + anexos.map(a => `
                        <div class="anexo-card" data-id="${a.id}">
                            <div class="anexo-thumb" data-anexo="${a.id}" data-tipo="${esc(a.tipo)}">
                                <div class="anexo-loading">...</div>
                            </div>
                            <div class="anexo-info">
                                <div class="anexo-nome" title="${esc(a.nome)}">${esc(a.nome)}</div>
                                <div class="anexo-meta">${fmtTamanho(a.tamanho)} · ${esc(a.autor)}</div>
                            </div>
                            <div class="anexo-actions">
                                <button class="btn btn-sm" data-download="${a.id}">Baixar</button>
                                <button class="btn btn-delete btn-sm" data-del-anexo="${a.id}">×</button>
                            </div>
                        </div>
                    `).join('') + '</div>'}
            </div>
            <div class="anexo-upload">
                <label class="btn btn-secondary" for="input-anexo">📎 Adicionar arquivos</label>
                <input type="file" id="input-anexo" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" hidden>
                <div class="upload-status" id="upload-status"></div>
            </div>
        `;
    }

    function render() {
        modal.body.innerHTML = `
            <div class="tabs">
                <button class="tab active" data-tab="detalhes">Detalhes</button>
                <button class="tab" data-tab="comentarios">💬 Comentários (${(tarefa.comentarios || []).length})</button>
                <button class="tab" data-tab="anexos">📎 Anexos (${(tarefa.anexos || []).length})</button>
            </div>
            <div class="tab-content" id="tab-content"></div>
        `;

        const tabContent = modal.body.querySelector('#tab-content') as HTMLElement;

        function mostrarAba(aba: string) {
            modal.body.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', (t as HTMLElement).dataset.tab === aba));
            if (aba === 'detalhes') tabContent.innerHTML = renderAbaDetalhes();
            else if (aba === 'comentarios') tabContent.innerHTML = renderAbaComentarios();
            else if (aba === 'anexos') { tabContent.innerHTML = renderAbaAnexos(); carregarAnexos(); }
        }

        modal.body.querySelectorAll('.tab').forEach(t => {
            t.addEventListener('click', () => mostrarAba((t as HTMLElement).dataset.tab || ''));
        });

        // Delegação para ações dentro do conteúdo
        tabContent.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const delCom = target.closest('[data-del-coment]') as HTMLElement | null;
            if (delCom) {
                if (confirm('Excluir este comentário?')) {
                    await excluirComentario(tarefa.id, delCom.dataset.delComent!);
                    const t = tarefas.find(x => x.id === tarefa.id);
                    tarefa = { ...tarefa, comentarios: (tarefa.comentarios || []).filter(c => c.id !== delCom.dataset.delComent) } as Tarefa;
                    if (t) t.comentarios = tarefa.comentarios;
                    render();
                    (modal.body.querySelectorAll('.tab')[1] as HTMLElement).click();
                    if (depois) depois();
                }
            }
            const delAnex = target.closest('[data-del-anexo]') as HTMLElement | null;
            if (delAnex) {
                if (confirm('Excluir este anexo?')) {
                    await excluirAnexo(tarefa.id, delAnex.dataset.delAnexo!);
                    tarefa.anexos = tarefa.anexos || [];
                    tarefa.anexos = tarefa.anexos.filter(a => a.id !== delAnex.dataset.delAnexo);
                    const t = tarefas.find(x => x.id === tarefa.id);
                    if (t) t.anexos = tarefa.anexos;
                    render();
                    (modal.body.querySelectorAll('.tab')[2] as HTMLElement).click();
                    if (depois) depois();
                }
            }
            const dlAnex = target.closest('[data-download]') as HTMLElement | null;
            if (dlAnex) {
                const blob = await obterBlobAnexo(tarefa.id, dlAnex.dataset.download!);
                const a = (tarefa.anexos || []).find(x => x.id === dlAnex.dataset.download);
                if (blob && a) downloadBlob(blob, a.nome);
            }
            const thumb = target.closest('[data-anexo]') as HTMLElement | null;
            if (thumb) {
                if (thumb.dataset.tipo && thumb.dataset.tipo.startsWith('image/')) {
                    const blob = await obterBlobAnexo(tarefa.id, thumb.dataset.anexo!);
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        abrirLightbox(url, (thumb as HTMLImageElement).alt);
                    }
                }
            }
        });

        // Form de novo comentário
        tabContent.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            if (target.id === 'btn-add-comentario') {
                const ta = tabContent.querySelector('#novo-comentario') as HTMLTextAreaElement;
                const texto = ta.value.trim();
                if (!texto) return;
                const novo = await adicionarComentario(tarefa.id, texto);
                tarefa.comentarios = tarefa.comentarios || [];
                tarefa.comentarios.push(novo);
                const tArr = tarefas.find(x => x.id === tarefa.id);
                if (tArr) tArr.comentarios = tarefa.comentarios;
                render();
                (modal.body.querySelectorAll('.tab')[1] as HTMLElement).click();
                if (depois) depois();
            }
        });

        // Upload de anexos
        const inputAnexo = tabContent.querySelector('#input-anexo') as HTMLInputElement;
        if (inputAnexo) {
            inputAnexo.addEventListener('change', async (e) => {
                const input = e.target as HTMLInputElement;
                const files = Array.from(input.files || []);
                if (!files.length) return;
                const status = tabContent.querySelector('#upload-status') as HTMLElement;
                status.textContent = `Enviando ${files.length} arquivo(s)...`;

                for (const f of files) {
                    try {
                        const a = await adicionarAnexo(tarefa.id, f);
                        tarefa.anexos = tarefa.anexos || [];
                        tarefa.anexos.push(a);
                        const tArr = tarefas.find(x => x.id === tarefa.id);
                        if (tArr) tArr.anexos = tarefa.anexos;
                    } catch (err: any) {
                        toast('Erro ao enviar: ' + f.name, 'erro');
                    }
                }
                status.textContent = '';
                inputAnexo.value = '';
                render();
                (modal.body.querySelectorAll('.tab')[2] as HTMLElement).click();
                toast('Anexos enviados!');
                if (depois) depois();
            });
        }

        async function carregarAnexos() {
            for (const a of (tarefa.anexos || [])) {
                if (a.tipo && a.tipo.startsWith('image/')) {
                    const blob = await obterBlobAnexo(tarefa.id, a.id);
                    if (!blob) continue;
                    const url = await blobParaDataURL(blob);
                    const thumb = modal.body.querySelector(`[data-anexo="${a.id}"]`);
                    if (thumb) thumb.innerHTML = `<img src="${url}" alt="${esc(a.nome)}">`;
                } else {
                    const thumb = modal.body.querySelector(`[data-anexo="${a.id}"]`);
                    if (thumb) thumb.innerHTML = `<div class="anexo-ext">${esc((a.nome.split('.').pop() || '?').toUpperCase().slice(0, 4))}</div>`;
                }
            }
        }

        mostrarAba('detalhes');
    }

    render();
}
