// ============================================================
// VIEW - Dashboard
// ============================================================

registrarView('dashboard', {
    titulo: 'Dashboard',

    async render(container) {
        const equipes = await getEquipes();
        const projetos = await getProjetos();
        const tarefas = await getTarefas();
        const pessoal = await getPessoal();
        const notificacoes = await getNotificacoes();
        const user = getCurrentUser();

        const totalEquipes = equipes.length;
        const totalProjetos = projetos.length;
        const totalFuncionarios = pessoal.length;
        const totalMembros = equipes.reduce((acc, e) => acc + (e.membros ? e.membros.length : 0), 0);

        const emAndamento = projetos.filter(p => p.status === 'em_andamento').length;
        const concluidos = projetos.filter(p => p.status === 'concluido').length;

        const tarefasPendentes = tarefas.filter(t => t.status === 'a_fazer' || t.status === 'em_andamento').length;
        const tarefasConcluidas = tarefas.filter(t => t.status === 'concluido').length;

        const atrasadas = notificacoes.filter(n => n.severidade === 'atrasado').length;
        const proximas = notificacoes.filter(n => n.severidade === 'proximo').length;

        const cards = [
            { icone: '👤', valor: totalFuncionarios, rotulo: 'Funcionários' },
            { icone: '👥', valor: totalEquipes, rotulo: 'Equipes' },
            { icone: '📋', valor: totalProjetos, rotulo: 'Projetos' },
            { icone: '🧑‍🤝‍🧑', valor: totalMembros, rotulo: 'Membros' },
            { icone: '✅', valor: tarefasConcluidas, rotulo: 'Tarefas concluídas' }
        ];

        container.innerHTML = `
            <div class="welcome">
                <h2>Bem-vindo, ${esc(user.nome.split(' ')[0])}!</h2>
                <p>Visão geral da sua gestão de equipes e projetos.</p>
            </div>

            <div class="cards-grid">
                ${cards.map(c => `
                    <div class="stat-card">
                        <div class="stat-icon">${c.icone}</div>
                        <div class="stat-info">
                            <div class="stat-value">${c.valor}</div>
                            <div class="stat-label">${c.rotulo}</div>
                        </div>
                    </div>
                `).join('')}
            </div>

            ${(atrasadas > 0 || proximas > 0) ? `
                <div class="dash-alert">
                    <span>⚠️ Você tem <strong>${atrasadas}</strong> item(ns) atrasado(s) e <strong>${proximas}</strong> próximo(s) do vencimento.</span>
                    <a href="#" data-view="notificacoes">Ver detalhes →</a>
                </div>
            ` : ''}

            <div class="dash-cols">
                <div class="dash-col">
                    <h3>Progresso dos Projetos</h3>
                    <div class="progress-summary">
                        <div class="progress-item">
                            <span>Em andamento</span>
                            <strong>${emAndamento}</strong>
                        </div>
                        <div class="progress-item">
                            <span>Concluídos</span>
                            <strong>${concluidos}</strong>
                        </div>
                        <div class="progress-item">
                            <span>Total</span>
                            <strong>${totalProjetos}</strong>
                        </div>
                    </div>
                    <div class="mini-bar">
                        <div class="mini-bar-fill" style="width:${totalProjetos ? Math.round((emAndamento + concluidos) / totalProjetos * 100) : 0}%"></div>
                    </div>
                </div>

                <div class="dash-col">
                    <h3>Status das Tarefas</h3>
                    <div class="progress-summary">
                        <div class="progress-item">
                            <span>Pendentes</span>
                            <strong>${tarefasPendentes}</strong>
                        </div>
                        <div class="progress-item">
                            <span>Concluídas</span>
                            <strong>${tarefasConcluidas}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dash-col">
                <h3>Últimos Projetos</h3>
                <div id="dash-projetos"></div>
            </div>
        `;

        const recentes = [...projetos].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).slice(0, 5);
        const projDiv = container.querySelector('#dash-projetos');

        if (recentes.length === 0) {
            projDiv.innerHTML = '<p class="empty-state">Nenhum projeto ainda. Crie seu primeiro projeto!</p>';
        } else {
            projDiv.innerHTML = recentes.map(p => `
                <div class="dash-projeto">
                    <div class="dash-projeto-info">
                        <strong>${esc(p.nome)}</strong>
                        <span>${esc(p.cliente || '—')} · Prazo: ${fmtData(p.prazo) || '—'}</span>
                    </div>
                    <span class="badge ${p.status}">${rotuloStatus(p.status)}</span>
                </div>
            `).join('');
        }

        // Atualiza o badge da sidebar
        atualizarIndicadorNotificacoes();
    }
});
