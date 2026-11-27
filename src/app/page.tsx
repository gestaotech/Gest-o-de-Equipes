import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  ListTodo,
  MessageSquare,
  Target,
  TrendingUp,
  Users,
  Shield,
  Sparkles,
  Megaphone,
  Rocket,
  Lock,
  Globe,
  BarChart3,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Users,
    title: "Colaboradores e departamentos",
    desc: "Organize o time com cargos, gestores, departamentos e status. Gerencie acesso por papéis.",
  },
  {
    icon: FolderKanban,
    title: "Projetos e tarefas",
    desc: "Planeje, priorize e acompanhe o que importa. Quadros, prazos e responsáveis em um só lugar.",
  },
  {
    icon: Target,
    title: "Metas e KPIs",
    desc: "Defina objetivos, acompanhe progresso e mantenha a equipe alinhada ao resultado.",
  },
  {
    icon: Calendar,
    title: "Agenda integrada",
    desc: "Reuniões, eventos de equipe e prazos de projetos na mesma visão de calendário.",
  },
  {
    icon: Megaphone,
    title: "Avisos e comunicados",
    desc: "Publique comunicados para a empresa, um time ou um colaborador, com notificações.",
  },
  {
    icon: Shield,
    title: "Segurança e RBAC",
    desc: "Controle granular de permissões por papel. Dados isolados por organização.",
  },
];

const STEPS = [
  { n: "01", t: "Crie sua empresa", d: "Cadastre-se e configure sua organização em segundos." },
  { n: "02", t: "Monte o time", d: "Adicione colaboradores, departamentos e equipes." },
  { n: "03", t: "Planeje o trabalho", d: "Crie projetos, tarefas e metas com prazos." },
  { n: "04", t: "Acompanhe tudo", d: "Dashboard em tempo real, agenda e comunicações." },
];

const FAQ = [
  {
    q: "O que é o TeamFlow?",
    a: "É a plataforma de gestão operacional da sua empresa: colaboradores, departamentos, equipes, projetos, tarefas, metas, agenda e comunicados em um único lugar.",
  },
  {
    q: "Como faço para contratar?",
    a: "Escolha na página inicial a modalidade sem integração ou com integração e fale com nossa equipe pelo WhatsApp.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. Usamos PostgreSQL gerenciado, criptografia de senhas e controle de acesso por papel. Cada organização tem seus dados isolados.",
  },
  {
    q: "Qual é a diferença entre as modalidades?",
    a: "Na modalidade sem integração, sua empresa utiliza o Gestão de Equipes de forma independente. Na modalidade com integração, avaliamos as conexões necessárias com outros sistemas.",
  },
  {
    q: "Como são definidos os valores?",
    a: "Nossa equipe comercial entende a estrutura da empresa, a quantidade de usuários e as integrações desejadas para apresentar uma proposta.",
  },
];

const TESTIMONIALS = [
  {
    name: "Carla Mendes",
    role: "Gerente de Operações",
    company: "LogiFlow Transportes",
    text: "O TeamFlow transformou como gerenciamos nossas equipes.",
    avatar: "C",
  },
  {
    name: "Roberto Silva",
    role: "Proprietário",
    company: "TechSolutions",
    text: "A melhor decisão que tomamos para nossa gestão.",
    avatar: "R",
  },
  { name: "Fernanda Costa", role: "Coordenadora RH", company: "FastRh Consultoria", text: "O controle de colaboradores e departamentos nunca foi tão simples.", avatar: "F" },
];

const USE_CASES = [
  { icon: Rocket, title: "Onboarding rápido", desc: "Cadastre sua organização, adicione colaboradores e comece a operar em minutos." },
  { icon: BarChart3, title: "Acompanhamento de performance", desc: "Veja indicadores de produtividade, tarefas concluídas e metas atingidas em tempo real." },
  { icon: Globe, title: "Multi-organizações", desc: "Uma conta, múltiplas organizações. Gerencie diferentes empresas ou departamentos com isolamento total de dados." },
  { icon: Lock, title: "Controle de acesso granular", desc: "Defina quem pode ver e editar cada recurso com base em papéis (OWNER, ADMIN, MANAGER, LEADER, MEMBER)." },
];

const INTEGRATIONS = [
  { name: "Google Calendar", desc: "Eventos e reuniões (em breve)" },
  { name: "WhatsApp", desc: "Notificações e lembretes (em breve)" },
  { name: "Google Drive", desc: "Anexos e documentos (em breve)" },
  { name: "Slack", desc: "Comunicação de equipe (em breve)" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Stats />
        <Features />
        <UseCases />
        <Testimonials />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
      <div className="page-container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="hidden sm:inline text-xl font-bold text-foreground">TeamFlow</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="#recursos" className="transition-colors hover:text-foreground">Recursos</a>
          <a href="#como-funciona" className="transition-colors hover:text-foreground">Como funciona</a>
          <a href="#planos" className="transition-colors hover:text-foreground">Planos</a>
          <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Entrar
          </Link>
          <a href="#planos" className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700">
            Contratar sistema <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(37,99,235,0.10),transparent)]" />
      <div className="page-container relative py-24 text-center sm:py-32">
        <Badge className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          <Sparkles className="mr-1 h-3 w-3" /> Novo: Visão de metas por equipe
        </Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          A operação do seu time,{" "}
          <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
            em um só lugar
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Colaboradores, departamentos, equipes, projetos, tarefas e metas organizados em uma plataforma que sua empresa realmente usa.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:justify-center">
          <a href="#planos" className="inline-flex h-12 items-center gap-2 rounded-lg bg-blue-600 px-7 text-base font-medium text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700">
            Ver opções de contratação <ArrowRight className="h-4 w-4" />
          </a>
          <a href="https://wa.me/5561998361296?text=Ol%C3%A1%21%20Gostaria%20de%20conhecer%20o%20Gest%C3%A3o%20de%20Equipes." target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center rounded-lg border border-border bg-background px-7 text-base font-medium text-foreground transition-colors hover:bg-accent">
            Falar com vendas
          </a>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { icon: Users, label: "Colaboradores" },
            { icon: FolderKanban, label: "Projetos" },
            { icon: ListTodo, label: "Tarefas" },
            { icon: Target, label: "Metas" },
            { icon: Calendar, label: "Agenda" },
            { icon: MessageSquare, label: "Avisos" },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-2 p-3 rounded-xl border bg-card hover:border-blue-300/50 hover:bg-blue-50/5 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <f.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { label: "Colaboradores gerenciados", value: "10k+" },
    { label: "Projetos concluídos", value: "50k+" },
    { label: "Tarefas criadas", value: "200k+" },
    { label: "Equipes ativas", value: "5k+" },
  ];

  return (
    <section className="border-y bg-muted/40 py-16 sm:py-24">
      <div className="page-container">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2 p-6 rounded-xl bg-white border border-border shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="text-2xl font-bold text-foreground">{s.value}</span>
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="recursos" className="page-container py-24 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-blue-600">Recursos</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Tudo que sua operação precisa</h2>
        <p className="mt-3 text-muted-foreground">Módulos completos, isolados por organização e com controle de acesso por papel.</p>
      </div>
      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-6 transition-all hover:shadow-xl border-b-2 border-transparent hover:border-blue-600/50">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-3 text-sm text-muted-foreground">{f.desc}</p>
            <div className="mt-6 flex items-center gap-2 text-sm font-medium text-blue-600">
              <ArrowRight className="h-3.5 w-3.5" /> Saiba mais
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function UseCases() {
  return (
    <section id="casos-uso" className="page-container py-24 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-blue-600">Casos de uso</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Como equipes usam o TeamFlow</h2>
      </div>
      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map((u) => (
          <Card key={u.title} className="p-6 rounded-xl border border-border hover:border-blue-200 hover:bg-blue-50/5 transition-all">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <u.icon className="h-6 w-6" />
            </div>
            <h3 className="font-semibold">{u.title}</h3>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{u.desc}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="page-container py-24 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-blue-600">Depoimentos</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">O que nossos clientes dizem</h2>
      </div>
      <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <Card key={t.name} className="p-6 rounded-xl border border-border hover:border-blue-200 transition-all">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-sm">{t.avatar}</div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.role}, {t.company}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{t.text}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="como-funciona" className="border-y bg-muted/40 py-20 sm:py-24">
      <div className="page-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-blue-600">Como funciona</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Do zero ao time produtivo em minutos</h2>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              {i < STEPS.length - 1 && (
                <ChevronRight className="absolute -right-4 top-6 hidden h-5 w-5 text-muted-foreground/50 lg:block" />
              )}
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">{s.n}</div>
              <h3 className="mt-4 font-semibold">{s.t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const options = [
    { title: "Sem integração entre sistemas", description: "Ideal para organizar colaboradores, equipes, projetos, tarefas e metas em uma única plataforma.", features: ["Uso independente do Gestão de Equipes", "Gestão de colaboradores e departamentos", "Projetos, tarefas, metas e indicadores", "Implantação orientada pela nossa equipe"], href: "https://wa.me/5561998361296?text=Ol%C3%A1%21%20Tenho%20interesse%20em%20contratar%20o%20Gest%C3%A3o%20de%20Equipes%20sem%20integra%C3%A7%C3%A3o%20entre%20sistemas.", label: "Contratar sem integração" },
    { title: "Com integração entre sistemas", description: "Para empresas que desejam conectar o Gestão de Equipes a outros sistemas e automatizar seus processos.", features: ["Todos os recursos da modalidade sem integração", "Levantamento dos sistemas que serão conectados", "Avaliação técnica das integrações necessárias", "Proposta comercial personalizada"], href: "https://wa.me/5561998361296?text=Ol%C3%A1%21%20Tenho%20interesse%20em%20contratar%20o%20Gest%C3%A3o%20de%20Equipes%20com%20integra%C3%A7%C3%A3o%20entre%20sistemas.", label: "Contratar com integração", highlight: true },
  ];
  return (
    <section id="planos" className="page-container py-24 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-blue-600">Contratação</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Escolha como sua empresa quer utilizar o sistema</h2>
        <p className="mt-3 text-muted-foreground">Fale diretamente com nossa equipe comercial. Vamos entender sua necessidade e orientar a contratação.</p>
      </div>
      <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-2">
        {options.map((option) => (
          <div key={option.title} className={option.highlight ? "relative rounded-2xl border-2 border-blue-600 bg-card p-7 shadow-lg" : "rounded-2xl border border-border bg-card p-7"}>
            {option.highlight && <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Solução personalizada</span>}
            <h3 className="text-xl font-semibold">{option.title}</h3>
            <p className="mt-3 min-h-14 text-sm leading-relaxed text-muted-foreground">{option.description}</p>
            <ul className="mt-6 space-y-3">
              {option.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><span>{feature}</span></li>)}
            </ul>
            <a href={option.href} target="_blank" rel="noopener noreferrer" className={option.highlight ? "mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700" : "mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold transition-colors hover:bg-accent"}>{option.label} <ArrowRight className="h-4 w-4" /></a>
          </div>
        ))}
      </div>
      <p className="mt-7 text-center text-sm text-muted-foreground">Valores, prazos e condições são apresentados pela equipe comercial após entender sua necessidade.</p>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="border-t bg-muted/40 py-20 sm:py-32">
      <div className="page-container max-w-3xl">
        <h2 className="text-center text-3xl font-bold tracking-tight">Perguntas frequentes</h2>
        <div className="mt-8 space-y-4">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border bg-card p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {f.q}
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="page-container py-24 sm:py-32">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-14 text-center text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,255,255,0.15),transparent)]" />
        <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">Pronto para organizar sua operação?</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-blue-100">Escolha a modalidade ideal para sua empresa e converse com nossa equipe para iniciar a contratação.</p>
        <div className="relative mt-7">
          <a href="#planos" className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-base font-medium text-blue-700 transition-colors hover:bg-blue-50">Ver opções de contratação <ArrowRight className="h-4 w-4" /></a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-muted/40 py-10">
      <div className="page-container flex flex-col items-center justify-between gap-6 sm:flex-row">
        <Logo />
        <div className="flex gap-6 text-sm text-muted-foreground">
          <a href="#recursos" className="hover:text-foreground">Recursos</a>
          <a href="#planos" className="hover:text-foreground">Planos</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </div>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} TeamFlow. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}