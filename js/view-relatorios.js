// ============================================================
// VIEW - Relatórios
// ============================================================

registrarView('relatorios', {
    titulo: 'Relatórios',

    async render(container) {
        const equipes = await getEquipes();
        const projetos = await getProjetos();
        const tarefas = await getTarefas();

        function nomeEquipe(id) {
            const e = equipes.find(x => x.id === id);
            return e ? e.nome : '';
        }

        // ---- Resumo geral ----
        const totalProjetos = projetos.length;
        const totalTarefas = tarefas.length;
        const concluidas = tarefas.filter(t => t.status === 'concluido').length;
        const taxaConclusao = totalTarefas ? Math.round(concluidas / totalTarefas * 100) : 0;
        const atrasadas = tarefas.filter(t => t.prazo && new Date(t.prazo) < new Date() && t.status !== 'concluido').length;

        container.innerHTML = `
            <div class="cards-grid">
                <div class="stat-card">
                    <div class="stat-icon">📋</div>
                    <div class="stat-info">
                        <div class="stat-value">${totalProjetos}</div>
                        <div class="stat-label">Projetos</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📝</div>
                    <div class="stat-info">
                        <div class="stat-value">${totalTarefas}</div>
                        <div class="stat-label">Tarefas</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">✅</div>
                    <div class="stat-info">
                        <div class="stat-value">${taxaConclusao}%</div>
                        <div class="stat-label">Taxa de conclusão</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⏰</div>
                    <div class="stat-info">
                        <div class="stat-value">${atrasadas}</div>
                        <div class="stat-label">Tarefas atrasadas</div>
                    </div>
                </div>
            </div>

            <div class="dash-cols">
                <div class="dash-col">
                    <h3>Projetos por Status</h3>
                    ${renderBarras([
                        { label: 'Planejamento', valor: projetos.filter(p => p.status === 'planejamento').length, cor: '#17a2b8' },
                        { label: 'Em andamento', valor: projetos.filter(p => p.status === 'em_andamento').length, cor: '#ffc107' },
                        { label: 'Pausado', valor: projetos.filter(p => p.status === 'pausado').length, cor: '#6c757d' },
                        { label: 'Concluído', valor: projetos.filter(p => p.status === 'concluido').length, cor: '#28a745' }
                    ], totalProjetos)}
                </div>
                <div class="dash-col">
                    <h3>Distribuição por Equipe</h3>
                    ${renderListaEquipes(equipes, projetos)}
                </div>
            </div>

            <div class="dash-col">
                <h3>Tarefas por Projeto</h3>
                ${renderTabelaTarefas(projetos, tarefas, nomeEquipe)}
            </div>
        `;
    }
});

function renderBarras(items, total) {
    return `
        <div class="report-bars">
            ${items.map(i => `
                <div class="report-bar-item">
                    <div class="report-bar-label">${i.label} <strong>${i.valor}</strong></div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width:${total ? Math.round(i.valor / total * 100) : 0}%;background:${i.cor}"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderListaEquipes(equipes, projetos) {
    if (equipes.length === 0) return '<p class="empty-state">Nenhuma equipe cadastrada.</p>';
    return `
        <div class="report-list">
            ${equipes.map(e => {
                const proj = projetos.filter(p => p.equipeId === e.id).length;
                const membros = e.membros ? e.membros.length : 0;
                return `
                    <div class="report-list-item">
                        <div class="report-list-main">
                            <strong>${esc(e.nome)}</strong>
                            <span>${membros} membro(s)</span>
                        </div>
                        <span class="badge dept">${proj} projeto(s)</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderTabelaTarefas(projetos, tarefas, nomeEquipe) {
    if (projetos.length === 0) return '<p class="empty-state">Nenhum projeto cadastrado.</p>';

    return `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Projeto</th>
                    <th>Equipe</th>
                    <th>Total de tarefas</th>
                    <th>Concluídas</th>
                    <th>Em andamento</th>
                    <th>A fazer</th>
                </tr>
            </thead>
            <tbody>
                ${projetos.map(p => {
                    const taf = tarefas.filter(t => t.projetoId === p.id);
                    return `
                        <tr>
                            <td><strong>${esc(p.nome)}</strong></td>
                            <td>${esc(nomeEquipe(p.equipeId)) || '—'}</td>
                            <td>${taf.length}</td>
                            <td>${taf.filter(t => t.status === 'concluido').length}</td>
                            <td>${taf.filter(t => t.status === 'em_andamento').length}</td>
                            <td>${taf.filter(t => t.status === 'a_fazer').length}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}
