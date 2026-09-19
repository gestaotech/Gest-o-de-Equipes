"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOnboarding } from "@/server/org-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import {
  Rocket,
  Building2,
  Target,
  Users,
  FolderKanban,
  ListTodo,
  MailPlus,
  CheckCircle2,
} from "lucide-react";

const STEPS = [
  { title: "Boas-vindas", desc: "Configuração rápida", icon: Rocket },
  { title: "Sua empresa", desc: "Dados básicos", icon: Building2 },
  { title: "Objetivo", desc: "O que você quer alcançar", icon: Target },
  { title: "Equipe", desc: "Nomeie sua primeira equipe", icon: Users },
  { title: "Projeto", desc: "De um nome ao primeiro projeto", icon: FolderKanban },
  { title: "Tarefa", desc: "Crie sua primeira tarefa", icon: ListTodo },
  { title: "Time", desc: "Convide colaboradores", icon: MailPlus },
  { title: "Finalizar", desc: "Tudo pronto!", icon: CheckCircle2 },
];

type WizardState = {
  companyName: string;
  segment: string;
  size: string;
  goal: string;
  teamName: string;
  projectName: string;
  taskTitle: string;
  taskDue: string;
};

export function OnboardingWizard({ companyName }: { companyName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<WizardState>({
    companyName,
    segment: "",
    size: "",
    goal: "",
    teamName: "",
    projectName: "",
    taskTitle: "",
    taskDue: "",
  });

  const update = (patch: Partial<WizardState>) =>
    setState((s) => ({ ...s, ...patch }));

  async function finish() {
    setLoading(true);
    const res: any = await saveOnboarding({
      ...state,
      step: STEPS.length - 1,
    });
    setLoading(false);
    if (res.success) {
      toast("Configuração concluída!");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 200);
    } else {
      toast(res.error?.message ?? "Erro ao finalizar.", "error");
    }
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4 text-center">
            <Rocket className="mx-auto h-10 w-10 text-blue-600" />
            <p className="text-muted-foreground">
              Vamos montar sua empresa por dentro do TeamFlow. Leva menos de 2
              minutos — e você pode pular qualquer etapa.
            </p>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="companyName">Nome da empresa</Label>
              <Input
                id="companyName"
                value={state.companyName}
                onChange={(e) => update({ companyName: e.target.value })}
                placeholder={companyName}
              />
            </div>
            <div>
              <Label htmlFor="segment">Segmento</Label>
              <Select
                id="segment"
                value={state.segment}
                onChange={(e) => update({ segment: e.target.value })}
              >
                <option value="">Selecione</option>
                <option value="tecnologia">Tecnologia</option>
                <option value="construcao">Construção</option>
                <option value="servicos">Serviços</option>
                <option value="comercio">Comércio</option>
                <option value="saude">Saúde</option>
                <option value="educacao">Educação</option>
                <option value="industria">Indústria</option>
                <option value="outro">Outro</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="size">Colaboradores</Label>
              <Select
                id="size"
                value={state.size}
                onChange={(e) => update({ size: e.target.value })}
              >
                <option value="">Selecione</option>
                <option value="1-10">1 a 10</option>
                <option value="11-50">11 a 50</option>
                <option value="51-200">51 a 200</option>
                <option value="200+">Mais de 200</option>
              </Select>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            {[
              { v: "organizar-tarefas", l: "Organizar as tarefas do time" },
              { v: "acompanhar-projetos", l: "Acompanhar projetos e prazos" },
              { v: "metas", l: "Definir e acompanhar metas" },
              { v: "reunioes", l: "Reduzir reuniões de status" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => update({ goal: o.v })}
                className={
                  state.goal === o.v
                    ? "flex w-full items-center gap-2 rounded-lg border-2 border-blue-600 bg-blue-50 px-4 py-3 text-left text-sm font-medium"
                    : "flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm hover:bg-accent"
                }
              >
                <Target className="h-4 w-4 text-blue-600" /> {o.l}
              </button>
            ))}
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="teamName">Nome da primeira equipe</Label>
              <Input
                id="teamName"
                value={state.teamName}
                onChange={(e) => update({ teamName: e.target.value })}
                placeholder="Ex.: Operações"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Você poderá criar mais equipes depois em Equipes.
            </p>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="projectName">Nome do projeto</Label>
              <Input
                id="projectName"
                value={state.projectName}
                onChange={(e) => update({ projectName: e.target.value })}
                placeholder="Ex.: Implantação do novo sistema"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Projetos agrupam as tarefas do time.
            </p>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="taskTitle">Título da tarefa</Label>
              <Input
                id="taskTitle"
                value={state.taskTitle}
                onChange={(e) => update({ taskTitle: e.target.value })}
                placeholder="Ex.: Levantar requisitos"
              />
            </div>
            <div>
              <Label htmlFor="taskDue">Prazo</Label>
              <Input
                id="taskDue"
                type="date"
                value={state.taskDue}
                onChange={(e) => update({ taskDue: e.target.value })}
              />
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4 text-center">
            <MailPlus className="mx-auto h-10 w-10 text-blue-600" />
            <p className="text-muted-foreground">
              Em breve você convidará seus colaboradores pela tela Colaboradores.
              Por enquanto, siga em frente.
            </p>
          </div>
        );
      case 7:
        return (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h3 className="text-lg font-semibold">Tudo pronto!</h3>
            <p className="text-muted-foreground">
              Clique em Começar e você será levado ao seu painel de controle.
            </p>
          </div>
        );
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardContent className="p-6">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              Etapa {step + 1} de {STEPS.length}
            </span>
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="font-medium text-blue-600 hover:underline"
            >
              Pular
            </button>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className={
                  i <= step
                    ? "h-1.5 flex-1 rounded-full bg-blue-600"
                    : "h-1.5 flex-1 rounded-full bg-muted"
                }
              />
            ))}
          </div>
          <div className="mt-4 text-center">
            <h2 className="text-lg font-semibold">{STEPS[step].title}</h2>
          </div>
        </div>

        {renderStep()}

        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Voltar
          </Button>
          {step === STEPS.length - 1 ? (
            <Button type="button" onClick={finish} loading={loading}>
              Começar
            </Button>
          ) : (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              Continuar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}