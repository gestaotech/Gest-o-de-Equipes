// ============================================================
// AUTH - Login simulado (client-side)
// NOTA: Este login é apenas uma simulação para MVP.
// Para produção, a autenticação deve ser feita no servidor.
// ============================================================

const AUTH_KEY = 'auth:current';

let currentUser = null;

// Inicializa a sessão
async function authInit() {
    await openDB();
    const stored = await dbGet(AUTH_KEY);
    currentUser = stored || null;
    return currentUser;
}

// Verifica se há usuário logado
function isLoggedIn() {
    return currentUser !== null;
}

// Retorna dados do usuário atual
function getCurrentUser() {
    return currentUser;
}

// Cadastra um novo usuário local
async function authRegister(nome, email, senha) {
    const key = `user:${email.toLowerCase()}:profile`;
    const existing = await dbGet(key);
    if (existing) {
        throw new Error('Este e-mail já está cadastrado.');
    }

    const uid = generateUid();
    const profile = {
        uid,
        nome,
        email: email.toLowerCase(),
        senha, // NOTA: em produção, a senha NUNCA deve ser armazenada assim
        criadoEm: new Date().toISOString()
    };

    // Persiste o perfil do usuário
    await dbSet(key, profile);

    // Cria/garante as coleções iniciais do usuário
    await dbSet(`user:${uid}:equipes`, []);
    await dbSet(`user:${uid}:projetos`, []);
    await dbSet(`user:${uid}:tarefas`, []);

    // Referência simplificada: email -> uid
    await dbSet(`auth:uid:${email.toLowerCase()}`, uid);

    // Define como sessão atual
    currentUser = { ...profile };
    await dbSet(AUTH_KEY, profile);
}

// Realiza o login
async function authLogin(email, senha) {
    const key = `user:${email.toLowerCase()}:profile`;
    const profile = await dbGet(key);

    if (!profile || profile.senha !== senha) {
        throw new Error('E-mail ou senha inválidos.');
    }

    currentUser = { ...profile };
    await dbSet(AUTH_KEY, profile);
    return currentUser;
}

// Encerra a sessão
async function authLogout() {
    await dbDelete(AUTH_KEY);
    currentUser = null;
}

// Gera um UID único
function generateUid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}
