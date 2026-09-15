// ============================================================
// AUTH - Autenticação via API (Neon Postgres)
// Sessão persistida por token em sessionStorage/localStorage
// ============================================================

const AUTH_TOKEN_KEY = 'ge:token';
const AUTH_USER_KEY = 'ge:usuario';

let currentUser: Usuario | null = null;

// Helper de fetch para a API
async function apiFetch(path: string, options?: RequestInit): Promise<any> {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options && options.headers) {
        Object.assign(headers, options.headers);
    }

    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data && data.erro ? data.erro : 'Erro na requisição. Tente novamente.');
    }
    return data;
}

// Converte o usuário retornado pela API para o tipo Usuario
function usuarioDaApi(u: any): Usuario {
    return {
        uid: u.id,
        nome: u.nome,
        email: u.email,
        senha: '',
        criadoEm: ''
    };
}

// Inicializa a sessão a partir do token persistido
async function authInit(): Promise<Usuario | null> {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
        currentUser = null;
        return null;
    }
    try {
        const d = await apiFetch('/api/auth');
        currentUser = usuarioDaApi(d.usuario);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
        return currentUser;
    } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        currentUser = null;
        return null;
    }
}

// Verifica se há usuário logado
function isLoggedIn(): boolean {
    return currentUser !== null;
}

// Retorna dados do usuário atual
function getCurrentUser(): Usuario | null {
    return currentUser;
}

// Cadastra um novo usuário
async function authRegister(nome: string, email: string, senha: string): Promise<void> {
    const d = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'registrar', nome, email, senha })
    });
    currentUser = usuarioDaApi(d.usuario);
    localStorage.setItem(AUTH_TOKEN_KEY, d.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));

    // Migra dados locais (IndexedDB) para o novo usuário no Postgres
    await migrarDadosLocais();
}

// Realiza o login
async function authLogin(email: string, senha: string): Promise<Usuario | null> {
    const d = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'login', email, senha })
    });
    currentUser = usuarioDaApi(d.usuario);
    localStorage.setItem(AUTH_TOKEN_KEY, d.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
    return currentUser;
}

// Encerra a sessão
async function authLogout(): Promise<void> {
    try {
        await apiFetch('/api/auth', {
            method: 'POST',
            body: JSON.stringify({ action: 'logout' })
        });
    } catch {
        // ignora falhas de rede no logout
    }
    currentUser = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    limparCacheDados();
}