// ============================================================
// VIEW - Configurações (exportar / importar dados)
// ============================================================

registrarView('configuracoes', {
    titulo: 'Configurações',

    async render(container) {
        const user = getCurrentUser();
        const equipes = await getEquipes();
        const projetos = await getProjetos();
        const tarefas = await getTarefas();
        const pessoal = await getPessoal();

        container.innerHTML = `
            <div class="config-grid">
                <div class="config-card">
                    <h3>👤 Perfil</h3>
                    <p><strong>Nome:</strong> ${esc(user.nome)}</p>
                    <p><strong>E-mail:</strong> ${esc(user.email)}</p>
                    <p class="muted">Plano Trial · Cadastrado em ${fmtData(user.criadoEm)}</p>
                </div>

                <div class="config-card">
                    <h3>📊 Resumo dos dados</h3>
                    <p>${equipes.length} equipe(s) · ${projetos.length} projeto(s) · ${tarefas.length} tarefa(s) · ${pessoal.length} funcionário(s)</p>
                </div>

                <div class="config-card">
                    <h3>💾 Exportar dados</h3>
                    <p>Faça backup dos seus dados ou exporte para usar em outro lugar.</p>
                    <div class="config-actions">
                        <button class="btn btn-primary" id="btn-export-json">Exportar JSON (completo)</button>
                        <button class="btn btn-secondary" id="btn-export-csv">Exportar CSV (múltiplos arquivos)</button>
                    </div>
                </div>

                <div class="config-card">
                    <h3>📥 Importar dados</h3>
                    <p>Importe um backup em JSON. <strong>Atenção:</strong> os dados atuais serão substituídos.</p>
                    <div class="config-actions">
                        <label class="btn btn-secondary" for="input-import">Selecionar arquivo...</label>
                        <input type="file" id="input-import" accept=".json" hidden>
                    </div>
                </div>

                <div class="config-card alerta">
                    <h3>⚠️ Zona de perigo</h3>
                    <p>Exclui permanentemente todos os dados deste usuário neste navegador.</p>
                    <div class="config-actions">
                        <button class="btn btn-delete" id="btn-limpar">Apagar todos os meus dados</button>
                    </div>
                </div>
            </div>
        `;

        // Exportar JSON
        container.querySelector('#btn-export-json').addEventListener('click', async () => {
            const dados = await exportarTudo();
            const nome = `gestao-${dados.usuario.email.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
            downloadTexto(JSON.stringify(dados, null, 2), nome, 'application/json');
            toast('Backup exportado!');
        });

        // Exportar CSV
        container.querySelector('#btn-export-csv').addEventListener('click', async () => {
            const equipesCSV = paraCSV(equipes, [
                { label: 'ID', get: e => e.id },
                { label: 'Nome', get: e => e.nome },
                { label: 'Departamento', get: e => e.departamento || '' },
                { label: 'Líder', get: e => e.lider || '' },
                { label: 'Descrição', get: e => e.descricao || '' },
                { label: 'Membros', get: e => (e.membros || []).join('|') },
                { label: 'Criado em', get: e => e.criadoEm || '' }
            ]);

            const projetosCSV = paraCSV(projetos, [
                { label: 'ID', get: p => p.id },
                { label: 'Nome', get: p => p.nome },
                { label: 'Cliente', get: p => p.cliente || '' },
                { label: 'Status', get: p => p.status },
                { label: 'Prazo', get: p => p.prazo || '' },
                { label: 'Equipe ID', get: p => p.equipeId || '' },
                { label: 'Descrição', get: p => p.descricao || '' }
            ]);

            const tarefasCSV = paraCSV(tarefas, [
                { label: 'ID', get: t => t.id },
                { label: 'Título', get: t => t.titulo },
                { label: 'Projeto ID', get: t => t.projetoId || '' },
                { label: 'Status', get: t => t.status },
                { label: 'Responsável', get: t => t.responsavel || '' },
                { label: 'Prazo', get: t => t.prazo || '' },
                { label: 'Descrição', get: t => t.descricao || '' },
                { label: 'Comentários', get: t => (t.comentarios || []).map(c => c.autor + ': ' + c.texto).join(' | ') }
            ]);

            const pessoalCSV = paraCSV(pessoal, [
                { label: 'ID', get: p => p.id },
                { label: 'Nome', get: p => p.nome },
                { label: 'Cargo', get: p => p.cargo || '' },
                { label: 'Função', get: p => p.funcao || '' },
                { label: 'Departamento', get: p => p.departamento || '' },
                { label: 'E-mail', get: p => p.email || '' },
                { label: 'Telefone', get: p => p.telefone || '' },
                { label: 'Criado em', get: p => p.criadoEm || '' }
            ]);

            // Cria um único arquivo com as seções
            const conteudo =
                '=== EQUIPES ===\n' + equipesCSV +
                '\n\n=== PROJETOS ===\n' + projetosCSV +
                '\n\n=== TAREFAS ===\n' + tarefasCSV +
                '\n\n=== PESSOAL ===\n' + pessoalCSV;

            const nome = `gestao-${new Date().toISOString().slice(0, 10)}.csv`;
            downloadTexto(conteudo, nome, 'text/csv;charset=utf-8');
            toast('CSV exportado!');
        });

        // Importar
        (container.querySelector('#input-import') as HTMLInputElement).addEventListener('change', async (e) => {
            const input = e.target as HTMLInputElement;
            const file = input.files ? input.files[0] : null;
            if (!file) return;
            if (!confirm('Importar substituirá os dados atuais. Continuar?')) {
                input.value = '';
                return;
            }
            try {
                const texto = await file.text();
                const dados = JSON.parse(texto);
                await importarTudo(dados);
                toast('Dados importados com sucesso!');
                setTimeout(() => location.reload(), 800);
            } catch (err: any) {
                toast('Erro: ' + (err as Error).message, 'erro');
            } finally {
                input.value = '';
            }
        });

        // Apagar tudo
        container.querySelector('#btn-limpar').addEventListener('click', async () => {
            if (!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
            if (!confirm('Última confirmação: apagar TODOS os dados?')) return;
            const uid = getCurrentUser().uid;
            await dbSet(`user:${uid}:equipes`, []);
            await dbSet(`user:${uid}:projetos`, []);
            await dbSet(`user:${uid}:tarefas`, []);
            await dbSet(`user:${uid}:pessoal`, []);
            toast('Dados apagados!', 'erro');
            setTimeout(() => location.reload(), 800);
        });
    }
});
