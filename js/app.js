// ============================================================
// APP - Bootstrap e controle de telas (landing ↔ login ↔ app)
// ============================================================

let loginTab = 'login';

function mostrarLanding() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('landing-page').classList.remove('hidden');
    document.body.classList.add('lp-mode');
}

function mostrarLogin() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.body.classList.remove('lp-mode');
}

function mostrarApp() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.body.classList.remove('lp-mode');
}

function preencherUsuario() {
    const user = getCurrentUser();
    if (!user) return;
    document.getElementById('user-name').textContent = user.nome;
    const ini = (user.nome || '?').trim().charAt(0).toUpperCase();
    document.getElementById('user-avatar').textContent = ini;
}

// ---- CTAs da landing page -> tela de login (na aba correta) ----
function irParaLogin(aba) {
    loginTab = aba;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === aba));
    document.getElementById('auth-cadastro-fields').classList.toggle('hidden', aba !== 'cadastro');
    document.getElementById('auth-submit').textContent = aba === 'cadastro' ? 'Criar conta' : 'Entrar';
    document.getElementById('auth-error').textContent = '';
    mostrarLogin();
    setTimeout(() => {
        if (aba === 'cadastro') {
            document.getElementById('auth-nome').focus();
        } else {
            document.getElementById('auth-email').focus();
        }
    }, 50);
}

document.getElementById('lp-btn-entrar').addEventListener('click', () => irParaLogin('login'));
document.getElementById('lp-btn-comecar').addEventListener('click', () => irParaLogin('cadastro'));
document.getElementById('lp-cta-principal').addEventListener('click', () => irParaLogin('cadastro'));
document.getElementById('lp-cta-secundario').addEventListener('click', () => {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('landing-page').classList.remove('hidden');
    document.querySelector('#planos').scrollIntoView({ behavior: 'smooth' });
});
document.getElementById('lp-cta-final').addEventListener('click', () => irParaLogin('cadastro'));

// Botões dos planos
document.querySelectorAll('[data-plan]').forEach(btn => {
    btn.addEventListener('click', () => {
        irParaLogin('cadastro');
    });
});

// Botão "Voltar" do login
document.getElementById('auth-back').addEventListener('click', () => {
    document.getElementById('auth-form').reset();
    document.getElementById('auth-error').textContent = '';
    mostrarLanding();
});

// Menu mobile da landing
document.getElementById('lp-menu-toggle').addEventListener('click', () => {
    document.querySelector('.lp-nav').classList.toggle('open');
});

// Fecha menu mobile ao clicar em um link
document.querySelectorAll('.lp-nav-links a').forEach(a => {
    a.addEventListener('click', () => {
        document.querySelector('.lp-nav').classList.remove('open');
    });
});

// Ano no rodapé
const anoEl = document.getElementById('lp-ano');
if (anoEl) anoEl.textContent = new Date().getFullYear();

// ---- Login form ----
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        loginTab = tab.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.getElementById('auth-cadastro-fields').classList.toggle('hidden', loginTab !== 'cadastro');
        document.getElementById('auth-submit').textContent = loginTab === 'cadastro' ? 'Criar conta' : 'Entrar';
        document.getElementById('auth-error').textContent = '';
    });
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const senha = document.getElementById('auth-senha').value;
    const nome = document.getElementById('auth-nome').value.trim();
    const errBox = document.getElementById('auth-error');
    errBox.textContent = '';

    try {
        if (loginTab === 'cadastro') {
            if (!nome) { errBox.textContent = 'Informe seu nome.'; return; }
            await authRegister(nome, email, senha);
        } else {
            await authLogin(email, senha);
        }
        preencherUsuario();
        mostrarApp();
        navegarPara('dashboard');
        atualizarIndicadorNotificacoes();
    } catch (err) {
        errBox.textContent = err.message;
    }
});

// Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
    await authLogout();
    document.getElementById('auth-form').reset();
    document.getElementById('auth-error').textContent = '';
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';
    mostrarLanding();
});

// Menu toggle (mobile)
document.getElementById('menu-toggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
});

document.addEventListener('click', (e) => {
    if (e.target.closest('[data-view]')) {
        document.querySelector('.sidebar').classList.remove('open');
    }
});

// ============================================================
// INIT
// ============================================================

(async function init() {
    const user = await authInit();

    if (user) {
        preencherUsuario();
        mostrarApp();
        navegarPara('dashboard');
        atualizarIndicadorNotificacoes();
    } else {
        mostrarLanding();
    }
})();
