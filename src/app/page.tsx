import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Target,
  TrendingUp,
  Users,
  Shield,
  Sparkles,
  Megaphone,
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

const PLANS = [
  {
    name: "Starter",
    price: "R$ 49,90",
    period: "/mês por empresa",
    desc: "Para começar a organizar pequenos times.",
    features: ["Até 10 colaboradores", "10 projetos ativos", "Todos os módulos", "Suporte por e-mail"],
    cta: "Escolher plano",
    highlight: false,
  },
  {
    name: "Professional",
    price: "R$ 99,00",
    period: "/mês por empresa",
    desc: "Para times em crescimento que precisam de relatórios.",
    features: [
      "Até 50 colaboradores",
      "Projetos ilimitados",
      "Relatórios avançados",
      "Integrações",
      "Suporte prioritário",
    ],
    cta: "Testar 14 dias grátis",
    highlight: true,
  },
  {
    name: "Business",
    price: "Sob consulta",
    period: "",
    desc: "Para empresas que querem escala e integrações.",
    features: [
      "Colaboradores ilimitados",
      "Tudo do Professional",
      "Integrações",
      "SSO e auditoria",
      "Gerente de conta dedicado",
    ],
    cta: "Falar com vendas",
    highlight: false,
  },
];

const FAQ = [
  { q: "O que é o TeamFlow?", a: "É a plataforma de gestão operacional da sua empresa: colaboradores, departamentos, equipes, projetos, tarefas, metas, agenda e comunicados em um único lugar." },
  { q: "Preciso de cartão de crédito para começar?", a: "Não. Comece com 14 dias grátis, sem cartão de crédito." },
  { q: "Meus dados ficam seguros?", a: "Sim. Usamos PostgreSQL gerenciado, criptografia de senhas e controle de acesso por papel. Cada organização tem seus dados isolados." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Você pode fazer downgrade ou cancelar a assinatura a qualquer momento, sem multa." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <SocialProof />
        <Features />
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
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="page-container flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="#recursos" className="transition-colors hover:text-foreground">Recursos</a>
          <a href="#como-funciona" className="transition-colors hover:text-foreground">Como funciona</a>
          <a href="#planos" className="transition-colors hover:text-foreground">Planos</a>
          <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Começar grátis
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(37,99,235,0.10),transparent)]"
      />
      <div className="page-container relative py-20 text-center sm:py-28">
        <Badge className="mb-5 bg-blue-50 px-3 py-1 text-blue-700">
          <Sparkles className="mr-1 h-3.5 w-3.5" /> Novo: visão de metas por equipe
        </Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          A operação do seu time,{" "}
          <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
            em um só lugar
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Colaboradores, departamentos, equipes, projetos, tarefas e metas
          organizados em uma plataforma que sua empresa realmente usa.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/cadastro"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-blue-600 px-6 text-base font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Começar grátis <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#recursos"
            className="inline-flex h-12 items-center rounded-lg border border-border bg-background px-6 text-base font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ver recursos
          </a>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Users, label: "Colaboradores" },
            { icon: FolderKanban, label: "Projetos" },
            { icon: ListTodo, label: "Tarefas" },
            { icon: Target, label: "Metas" },
          ].map((f) => (
            <div
              key={f.label}
              className="flex items-center justify-center gap-2 rounded-lg border bg-card py-3 text-sm font-medium text-muted-foreground"
            >
              <f.icon className="h-4 w-4 text-blue-600" /> {f.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="border-y bg-muted/40 py-10">
      <div className="page-container text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Feito para equipes que levam a operação a sério
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> +32% produtividade</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> 87% menos retrabalho</span>
          <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Prazos cumpridos em dia</span>
          <span className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> Menos reuniões de status</span>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="recursos" className="page-container py-20 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-blue-600">Recursos</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Tudo que sua operação precisa
        </h2>
        <p className="mt-3 text-muted-foreground">
          Módulos completos, isolados por organização e com controle de acesso por papel.
        </p>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-6 transition-shadow hover:shadow-md">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
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
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Do zero ao time produtivo em minutos
          </h2>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              {i < STEPS.length - 1 && (
                <ChevronRight className="absolute -right-4 top-6 hidden h-5 w-5 text-muted-foreground/50 lg:block" />
              )}
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                {s.n}
              </div>
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
  return (
    <section id="planos" className="page-container py-20 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-blue-600">Planos</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Escolha o plano certo
        </h2>
        <p className="mt-3 text-muted-foreground">
          Comece grátis e evolua quando sua equipe crescer.
        </p>
      </div>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={
              p.highlight
                ? "relative rounded-xl border-2 border-blue-600 bg-card p-6 shadow-lg"
                : "rounded-xl border bg-card p-6"
            }
          >
            {p.highlight && (
              <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                Mais popular
              </span>
            )}
            <h3 className="font-semibold">{p.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold">{p.price}</span>
              <span className="text-sm text-muted-foreground">{p.period}</span>
            </div>
            <ul className="mt-5 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/cadastro"
              className={
                p.highlight
                  ? "mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  : "mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg border border-border text-sm font-medium transition-colors hover:bg-accent"
              }
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="border-t bg-muted/40 py-20">
      <div className="page-container max-w-3xl">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Perguntas frequentes
        </h2>
        <div className="mt-8 space-y-4">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border bg-card p-5 [&_summary::-webkit-details-marker]:hidden"
            >
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
    <section className="page-container py-20">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-14 text-center text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,255,255,0.15),transparent)]"
        />
        <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
          Pronto para organizar sua operação?
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-blue-100">
          Crie sua conta grátis e monte o time, os projetos e as metas da sua empresa em minutos.
        </p>
        <div className="relative mt-7">
          <Link
            href="/cadastro"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-base font-medium text-blue-700 transition-colors hover:bg-blue-50"
          >
            Começar grátis <ArrowRight className="h-4 w-4" />
          </Link>
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
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} TeamFlow. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}