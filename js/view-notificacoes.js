// ============================================================
// VIEW - Notificações
// ============================================================

registrarView('notificacoes', {
    titulo: 'Notificações',

    async render(container) {
        const notifs = await getNotificacoes();
        const projetos = await getProjetos();

        const atrasadas = notifs.filter(n => n.severidade === 'atrasado');
        const proximas = notifs.filter(n => n.severidade === 'proximo');

        function renderGrupo(titulo, itens, classe) {
            if (itens.length === 0) return '';
            return `
                <div class="notif-grupo">
                    <h3 class="${classe}">${titulo} (${itens.length})</h3>
                    <div class="notif-lista">
                        ${itens.map(n => {
                            const ehTarefa = n.tipo === 'tarefa';
                            const goto = ehTarefa ? 'tarefas' : 'projetos';
                            return `
                                <a class="notif-item ${classe}" data-view="${goto}" data-id="${n.id}">
                                    <div class="notif-icone">${ehTarefa ? '✅' : '📋'}</div>
                                    <div class="notif-corpo">
                                        <strong>${esc(n.titulo)}</strong>
                                        <div class="notif-meta">
                                            ${ehTarefa ? 'Tarefa' : 'Projeto'} · Prazo: ${fmtData(n.prazo)}
                                        </div>
                                    </div>
                                    <div class="notif-dias">${n.dias === 'hoje' ? 'Vence hoje' : (typeof n.dias === 'number' ? n.dias + ' dia(s)' : n.dias)}</div>
                                </a>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="notif-resumo">
                <div class="stat-card ${atrasadas.length > 0 ? 'alerta' : ''}">
                    <div class="stat-icon">⚠️</div>
                    <div class="stat-info">
                        <div class="stat-value">${atrasadas.length}</div>
                        <div class="stat-label">Atrasados</div>
                    </div>
                </div>
                <div class="stat-card ${proximas.length > 0 ? 'alerta-amarelo' : ''}">
                    <div class="stat-icon">⏰</div>
                    <div class="stat-info">
                        <div class="stat-value">${proximas.length}</div>
                        <div class="stat-label">Vencem em até 3 dias</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-info">
                        <div class="stat-value">${notifs.length}</div>
                        <div class="stat-label">Total de alertas</div>
                    </div>
                </div>
            </div>

            ${renderGrupo('Tarefas e projetos atrasados', atrasadas, 'severidade-atrasado')}
            ${renderGrupo('Vencem nos próximos 3 dias', proximas, 'severidade-proximo')}

            ${notifs.length === 0
                ? '<p class="empty-state">Nenhuma notificação. Tudo em dia!</p>'
                : ''}
        `;

        // Clique em uma notificação navega para a view apropriada
        container.querySelectorAll('.notif-item').forEach(el => {
            el.addEventListener('click', () => {
                if (el.dataset.view === 'tarefas') {
                    sessao.projetoCtx = null;
                    navegarPara('tarefas');
                } else {
                    sessao.projetoCtx = el.dataset.id;
                    navegarPara('projetos');
                }
            });
        });
    }
});
