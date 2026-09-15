// ============================================================
// TIPOS GLOBAIS - Modelos de dados compartilhados
// ============================================================

interface Usuario {
    uid: string;
    nome: string;
    email: string;
    senha: string;
    criadoEm: string;
}

interface Pessoa {
    id: string;
    nome: string;
    cargo: string;
    funcao: string;
    departamento: string;
    email: string;
    telefone: string;
    criadoEm: string;
}

interface Equipe {
    id: string;
    nome: string;
    departamento: string;
    lider: string;
    descricao: string;
    membros: string[];
    criadoEm: string;
}

type StatusProjeto = 'planejamento' | 'em_andamento' | 'pausado' | 'concluido';

interface Projeto {
    id: string;
    nome: string;
    cliente: string;
    equipeId: string;
    prazo: string;
    status: StatusProjeto;
    descricao: string;
    criadoEm: string;
}

type StatusTarefa = 'a_fazer' | 'em_andamento' | 'concluido';

interface Comentario {
    id: string;
    texto: string;
    autor: string;
    criadoEm: string;
}

interface Anexo {
    id: string;
    nome: string;
    tipo: string;
    tamanho: number;
    criadoEm: string;
    autor: string;
}

interface Tarefa {
    id: string;
    titulo: string;
    projetoId: string;
    responsavel: string;
    status: StatusTarefa;
    prazo: string;
    descricao: string;
    comentarios?: Comentario[];
    anexos?: Anexo[];
    criadoEm: string;
    atualizadoEm?: string;
}

interface Notificacao {
    tipo: 'tarefa' | 'projeto';
    severidade: 'atrasado' | 'proximo';
    id: string;
    titulo: string;
    prazo: string;
    dias: number | string;
}

interface BackdadoExport {
    versao: number;
    exportadoEm: string;
    usuario: {
        nome: string;
        email: string;
    };
    equipes: Equipe[];
    projetos: Projeto[];
    tarefas: Tarefa[];
    pessoal: Pessoa[];
}

interface ViewDefinition {
    titulo: string;
    render(container: HTMLElement): void | Promise<void>;
}

interface Sessao {
    projetoCtx: string | null;
}