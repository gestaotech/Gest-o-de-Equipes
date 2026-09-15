// ============================================================
// UI - Helpers compartilhados, navegação e renderização
// ============================================================

// Escapa HTML para prevenir XSS
function esc(texto: any): string {
    const div = document.createElement('div');
    div.textContent = texto == null ? '' : String(texto);
    return div.innerHTML;
}

// Modal genérico: retorna objeto com métodos open/close/setContent
function criarModal(titulo: string, opts: { largo?: boolean } = {}): { body: HTMLElement; fechar: () => void } {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal' + (opts.largo ? ' modal-lg' : '');

    modal.innerHTML = `
        <div class="modal-header">
            <h3>${esc(titulo)}</h3>
            <button type="button" class="modal-close">&times;</button>
        </div>
        <div class="modal-body"></div>
    `;

    const bodyEl = modal.querySelector('.modal-body') as HTMLElement;
    overlay.appendChild(modal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || (e.target as HTMLElement).classList.contains('modal-close')) {
            fechar();
        }
    });

    function fechar() {
        overlay.remove();
    }

    document.body.appendChild(overlay);

    return { body: bodyEl, fechar };
}

// Exibe um toast/notificação
function toast(mensagem: string, tipo: 'sucesso' | 'erro' = 'sucesso'): void {
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = mensagem;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, 2500);
}

// Lightbox para visualização de imagem
function abrirLightbox(src: string, alt?: string): void {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.innerHTML = `
        <button type="button" class="lightbox-close">&times;</button>
        <img src="${src}" alt="${esc(alt || '')}">
    `;
    overlay.addEventListener('click', (e) => {
        if (e.target !== overlay.querySelector('img')) overlay.remove();
    });
    overlay.querySelector('.lightbox-close')!.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
}

// Download de blob a partir de uma URL temporária
function downloadBlob(blob: Blob, nome: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Dispara download de um texto como arquivo
function downloadTexto(conteudo: string, nome: string, mime: string = 'text/plain;charset=utf-8'): void {
    const blob = new Blob([conteudo], { type: mime });
    downloadBlob(blob, nome);
}

// Coluna de CSV
interface ColunaCSV<T> {
    label: string;
    get: (item: T) => any;
}

// Converte array de objetos para CSV (com cabeçalhos na primeira linha)
function paraCSV<T>(lista: T[], colunas: ColunaCSV<T>[]): string {
    if (!lista.length) return colunas.map(c => c.label).join(';') + '\n';
    const escapa = (v: any): string => {
        const s = v == null ? '' : String(v);
        if (s.includes(';') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    };
    const head = colunas.map(c => escapa(c.label)).join(';');
    const linhas = lista.map(item => colunas.map(c => escapa(c.get(item))).join(';'));
    return head + '\n' + linhas.join('\n');
}

// Converte Blob em Data URL (para exibir imagens armazenadas)
function blobParaDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Busca por nome universal
function buscar<T extends Record<string, any>>(lista: T[], termo: string, campos: string[]): T[] {
    const t = termo.toLowerCase().trim();
    if (!t) return lista;
    return lista.filter(item => {
        return campos.some(c => {
            const v = item[c];
            return v && String(v).toLowerCase().includes(t);
        });
    });
}

// Formata data ISO para dd/mm/aaaa
function fmtData(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR');
}

// Data + hora
function fmtDataHora(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Rótulo legível para status
function rotuloStatus(status: string): string {
    const map: Record<string, string> = {
        a_fazer: 'A fazer',
        em_andamento: 'Em andamento',
        concluido: 'Concluído',
        planejamento: 'Planejamento',
        ativo: 'Ativo',
        pausado: 'Pausado',
        cancelado: 'Cancelado'
    };
    return map[status] || status || '—';
}

// Tamanho legível de arquivo
function fmtTamanho(bytes: number): string {
    if (!bytes) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return n.toFixed(n < 10 ? 1 : 0) + ' ' + u[i];
}

// ------------------------------------------------------------------
// Navegação (SPA)
// ------------------------------------------------------------------

const sessao: Sessao = { projetoCtx: null };
let activeView: string | null = null;

const views: Record<string, ViewDefinition> = {};
function registrarView(nome: string, view: ViewDefinition): void { views[nome] = view; }

async function navegarPara(nome: string): Promise<void> {
    if (!views[nome]) return;

    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', (el as HTMLElement).dataset.view === nome);
    });

    const titulo = document.getElementById('page-title');
    if (titulo) titulo.textContent = views[nome].titulo;

    const container = document.getElementById('app-content') as HTMLElement;
    container.innerHTML = '';

    activeView = nome;

    try {
        await views[nome].render(container);
    } catch (err: any) {
        console.error(err);
        container.innerHTML = `<p class="empty-state">Erro ao carregar: ${esc(err.message)}</p>`;
    }
}

document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const nav = target ? (target.closest('[data-view]') as HTMLElement | null) : null;
    if (nav) {
        e.preventDefault();
        navegarPara(nav.dataset.view || '');
    }
});

// ------------------------------------------------------------------
// Sidebar: indicador de notificações
// ------------------------------------------------------------------

async function atualizarIndicadorNotificacoes(): Promise<void> {
    const badge = document.getElementById('notif-badge') as HTMLElement | null;
    if (!badge) return;
    const notifs = await getNotificacoes();
    if (notifs.length === 0) {
        badge.style.display = 'none';
    } else {
        badge.style.display = 'inline-block';
        badge.textContent = String(notifs.length);
    }
}