"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle
} from "@/components/ui/card";
import { 
  Input
} from "@/components/ui/input";
import { 
  Button
} from "@/components/ui/button";
import { 
  Select
} from "@/components/ui/input"; // Select is also in input.tsx
import { 
  Label
} from "@/components/ui/label";
import { 
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption
} from "@/components/ui/table";
import {
  Calendar,
  Clock,
  Filter,
  Search,
  User,
  Folder,
  Trash2,
  AlertTriangle,
  Shield,
  Info,
  Loader2
} from "lucide-react";
import { formatRelative, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { activityLabel } from "@/lib/queries";
import { toast } from "@/components/ui/toast";
import { toCsv } from "@/lib/csv";

type PeriodValue = "today" | "7d" | "30d" | "90d" | "this_month" | "last_month" | "this_year" | "custom";

// Tipos
type ActivityLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  userId: string | null;
  oldData: any;
  newData: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user: {
    name: string | null;
  } | null;
};

// Filtros
const ACTION_FILTERS = [
  { value: "", label: "Todas as ações" },
  { value: "organization.created", label: "Organização criada" },
  { value: "organization.updated", label: "Organização atualizada" },
  { value: "department.created", label: "Departamento criado" },
  { value: "department.updated", label: "Departamento atualizado" },
  { value: "department.deleted", label: "Departamento excluído" },
  { value: "team.created", label: "Equipe criada" },
  { value: "team.updated", label: "Equipe atualizada" },
  { value: "team.deleted", label: "Equipe excluída" },
  { value: "member.created", label: "Colaborador adicionado" },
  { value: "member.updated", label: "Colaborador atualizado" },
  { value: "member.deleted", label: "Colaborador removido" },
  { value: "member.role", label: "Papel do colaborador alterado" },
  { value: "project.created", label: "Projeto criado" },
  { value: "project.updated", label: "Projeto atualizado" },
  { value: "project.deleted", label: "Projeto excluído" },
  { value: "task.created", label: "Tarefa criada" },
  { value: "task.updated", label: "Tarefa atualizada" },
  { value: "task.status", label: "Status da tarefa alterado" },
  { value: "task.deleted", label: "Tarefa excluída" },
  { value: "goal.created", label: "Meta criada" },
  { value: "goal.updated", label: "Meta atualizada" },
  { value: "goal.deleted", label: "Meta excluído" },
  { value: "event.created", label: "Evento criado" },
  { value: "event.deleted", label: "Evento excluído" },
  { value: "announcement.created", label: "Aviso publicado" },
  { value: "announcement.deleted", label: "Aviso excluído" },
  { value: "PROFILE_UPDATED", label: "Perfil atualizado" },
  { value: "PASSWORD_CHANGED", label: "Senha alterada" },
  { value: "AVATAR_UPDATED", label: "Avatar atualizado" },
  { value: "AVATAR_REMOVED", label: "Avatar removido" },
  { value: "PREFERENCES_UPDATED", label: "Preferências atualizadas" },
  { value: "SESSION_REVOKED", label: "Sessão revogada" },
  { value: "SESSIONS_REVOKED", label: "Sessões revogadas" },
];

const ENTITY_FILTERS = [
  { value: "", label: "Todas as entidades" },
  { value: "organization", label: "Organização" },
  { value: "department", label: "Departamento" },
  { value: "team", label: "Equipe" },
  { value: "member", label: "Colaborador" },
  { value: "project", label: "Projeto" },
  { value: "task", label: "Tarefa" },
  { value: "goal", label: "Meta" },
  { value: "event", label: "Evento" },
  { value: "announcement", label: "Aviso" },
  { value: "user", label: "Usuário" },
];

const PERIOD_FILTERS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês anterior" },
  { value: "this_year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

const ActivityClient = ({
  orgId,
  canExport
}: {
  orgId: string;
  canExport: boolean;
}) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
const [filters, setFilters] = useState<{
  period: PeriodValue;
  userId: string;
  action: string;
  entity: string;
  search: string;
  dateFrom: Date | null;
  dateTo: Date | null;
}>({
  period: "30d",
  userId: "",
  action: "",
  entity: "",
  search: "",
  dateFrom: null,
  dateTo: null,
});
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  // Calcula a data com base no período selecionado
  const getDateRange = useCallback((period: string): { from: Date | null; to: Date | null } => {
    const now = new Date();
    const to = new Date(now);
    
    switch (period) {
      case "today":
        return {
          from: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          to: to
        };
      case "7d":
        return {
          from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          to: to
        };
      case "30d":
        return {
          from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          to: to
        };
      case "90d":
        return {
          from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          to: to
        };
      case "this_month":
        return {
          from: new Date(now.getFullYear(), now.getMonth(), 1),
          to: to
        };
      case "last_month":
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          from: lastMonth,
          to: endOfLastMonth
        };
      case "this_year":
        return {
          from: new Date(now.getFullYear(), 0, 1),
          to: to
        };
      default:
        return { from: null, to: null };
    }
  }, []);

  // Busca atividades com base nos filtros
  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Constrói a cláusula WHERE
      const where: any = { organizationId: orgId };
      
      // Filtro de período
      const { from, to } = getDateRange(filters.period);
      if (from && to) {
        where.createdAt = { gte: from, lte: to };
      } else if (filters.dateFrom && filters.dateTo) {
        where.createdAt = { gte: filters.dateFrom, lte: filters.dateTo };
      }
      
      // Filtro de usuário
      if (filters.userId) {
        where.userId = filters.userId;
      }
      
      // Filtro de ação
      if (filters.action) {
        where.action = filters.action;
      }
      
      // Filtro de entidade
      if (filters.entity) {
        where.entity = filters.entity;
      }
      
      // Filtro de pesquisa (busca em múltiplos campos)
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        where.OR = [
          { action: { contains: searchTerm } },
          { entity: { contains: searchTerm } },
          { user: { name: { contains: searchTerm } } },
        ];
      }
      
      // Conta total de registros para paginação
      const [countResult, dataResult] = await Promise.all([
        prisma.activityLog.count({ where }),
        prisma.activityLog.findMany({
          where,
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          skip: page * PAGE_SIZE,
          take: PAGE_SIZE,
        })
      ]);
      
      setActivities(dataResult);
      setTotalCount(countResult);
      setTotalPages(Math.ceil(countResult / PAGE_SIZE));
    } catch (err) {
      console.error("Erro ao buscar atividades:", err);
      setError("Falha ao carregar atividades. Por favor, tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [orgId, filters, page, PAGE_SIZE]);

  // Efeito para buscar atividades quando os filtros ou página mudarem
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Handlers para os filtros
const handlePeriodChange = (value: string) => {
  setFilters(prev => ({ ...prev, period: value as PeriodValue, dateFrom: null, dateTo: null }));
  setPage(0);
};

  const handleUserChange = (value: string) => {
    setFilters(prev => ({ ...prev, userId: value }));
    setPage(0);
  };

  const handleActionChange = (value: string) => {
    setFilters(prev => ({ ...prev, action: value }));
    setPage(0);
  };

  const handleEntityChange = (value: string) => {
    setFilters(prev => ({ ...prev, entity: value }));
    setPage(0);
  };

  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
    setPage(0);
  };

const handleDateChange = (type: "from" | "to", date: Date | null) => {
  setFilters(prev => ({
    ...prev,
    [type === "from" ? "dateFrom" : "dateTo"]: date,
    period: "custom"
  }));
  setPage(0);
};

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Formata o user agent para exibição amigável
  const formatUserAgent = (userAgent: string | null): string => {
    if (!userAgent) return "Desconhecido";
    
    // Usa a mesma lógica do lib/user-agent.ts
    const lower = userAgent.toLowerCase();
    
    let browser = "Navegador";
    if (/edg\//.test(lower)) browser = "Edge";
    else if (/opr\//.test(lower) || /opera/.test(lower)) browser = "Opera";
    else if (/crios\//.test(lower) || /chrome\//.test(lower)) browser = "Chrome";
    else if (/fxios/.test(lower) || /firefox\//.test(lower)) browser = "Firefox";
    else if (/safari\//.test(lower)) browser = "Safari";
    
    let os = "Sistema";
    if (/windows nt/.test(lower)) os = "Windows";
    else if (/android/.test(lower)) os = "Android";
    else if (/iphone|ipad|ios/.test(lower)) os = "iOS";
    else if (/mac os x|macintosh/.test(lower)) os = "macOS";
    else if (/linux/.test(lower)) os = "Linux";
    
    let device = "Dispositivo";
    if (/ipad/.test(lower)) device = "Tablet";
    else if (/iphone|ipod/.test(lower)) device = "Celular";
    else if (/android/.test(lower))
      device = /mobi|mobile/.test(lower) ? "Celular" : "Tablet";
    else if (/windows|macintosh|mac os|linux|x11/.test(lower)) device = "Computador";
    
    return `${browser} · ${os}`;
  };

  // Formata a data para exibição
  const formatDateDisplay = (date: Date): string => {
    return formatDate(date);
  };

  // Formata o tempo relativo
  const formatTimeAgo = (date: Date): string => {
    return formatRelative(date);
  };

  // Obtém o label amigável para a ação
  const getActionLabel = (action: string): string => {
    return activityLabel[action] ?? action;
  };

  // Obtém o ícone para a ação
  const getActionIcon = (action: string): any => {
    if (action.includes("created")) return <Calendar className="h-4 w-4" />;
    if (action.includes("updated") || action.includes("status")) return <Clock className="h-4 w-4" />;
    if (action.includes("deleted") || action.includes("removed")) return <Trash2 className="h-4 w-4" />;
    if (action.includes("role")) return <Shield className="h-4 w-4" />;
    if (action.includes("session")) return <Loader2 className="h-4 w-4" />;
    if (action.includes("password")) return <AlertTriangle className="h-4 w-4" />;
    if (action.includes("avatar")) return <User className="h-4 w-4" />;
    if (action.includes("preference")) return <Info className="h-4 w-4" />;
    return <Folder className="h-4 w-4" />;
  };

  // Converte atividades para formato CSV
  const generateActivityCsv = (activityLogs: ActivityLog[]): string => {
    const headers = [
      "Data/Hora",
      "Usuário",
      "Ação",
      "Entidade",
      "ID da Entidade",
      "Descrição da Ação",
      "IP",
      "User Agent"
    ];
    
    const rows = activityLogs.map(log => [
      formatDate(log.createdAt) + " " + log.createdAt.toTimeString().split(" ")[0],
      log.user?.name ?? "Sistema",
      getActionLabel(log.action),
      log.entity,
      log.entityId ?? "",
      log.entityId ? `${log.entity} ${log.action}` : "", // Descrição simplificada
      log.ipAddress ?? "",
      log.userAgent ?? ""
    ]);
    
    return toCsv(headers, rows);
  };

  // Exporta para CSV
  const exportToCSV = async () => {
    try {
      // Busca todas as atividades que correspondem aos filtros atuais (sem paginação)
      setLoading(true);
      
      // Constrói a cláusula WHERE mesma da busca paginada
      const where: any = { organizationId: orgId };
      
      // Filtro de período
      const { from, to } = getDateRange(filters.period);
      if (from && to) {
        where.createdAt = { gte: from, lte: to };
      } else if (filters.dateFrom && filters.dateTo) {
        where.createdAt = { gte: filters.dateFrom, lte: filters.dateTo };
      }
      
      // Filtro de usuário
      if (filters.userId) {
        where.userId = filters.userId;
      }
      
      // Filtro de ação
      if (filters.action) {
        where.action = filters.action;
      }
      
      // Filtro de entidade
      if (filters.entity) {
        where.entity = filters.entity;
      }
      
      // Filtro de pesquisa (busca em múltiplos campos)
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        where.OR = [
          { action: { contains: searchTerm } },
          { entity: { contains: searchTerm } },
          { user: { name: { contains: searchTerm } } },
        ];
      }
      
      // Busca todas as atividades correspondentes
      const allActivities = await prisma.activityLog.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" }
      });
      
      // Gera o CSV
      const csvContent = generateActivityCsv(allActivities);
      
      // Cria um blob e dispara o download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const fileName = `atividade_${new Date().toISOString().slice(0,10)}.csv`;
      
      // Cria um link temporário para download
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast(`Exportação concluída: ${fileName}`, "success");
    } catch (err) {
      console.error("Erro ao exportar:", err);
      toast("Falha ao exportar atividades.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
return (
       <Card className="w-full">
         <CardHeader>
           <CardTitle>Atividade</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="flex h-64 items-center justify-center">
             <Loader2 className="h-8 w-8 text-muted-foreground" />
           </div>
         </CardContent>
       </Card>
     );
  }

if (error) {
     return (
       <Card className="w-full">
         <CardHeader>
           <CardTitle>Atividade</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="p-6 text-center text-destructive">
           {error}
           <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchActivities()}>
             Tentar novamente
           </Button>
         </div>
         </CardContent>
       </Card>
     );
   }

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Card className="h-[100px]">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Filter className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Atividade</h2>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-sm text-muted-foreground">
                  Acompanhe as alterações e atividades realizadas na organização.
                </p>
              </CardContent>
            </Card>
          </div>
          
          {canExport && (
            <div className="flex-shrink-0">
              <Card className="h-[100px]">
                <CardHeader>
<div className="flex items-center gap-3">
                     <h2 className="text-lg font-semibold">Exportar</h2>
                   </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportToCSV}
                    className="w-full"
                  >
                    Exportar CSV
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid gap-6 mb-6">
        <div className="col-span-1 md:col-span-3 lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm font-medium mb-1">Período</Label>
                      <Select value={filters.period} onChange={(e) => handlePeriodChange(e.target.value)}>
                        {PERIOD_FILTERS.map(filter => (
                          <option key={filter.value} value={filter.value}>
                            {filter.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    
                    {filters.period === "custom" && (
                      <>
                        <div className="col-span-2">
                          <Label className="text-sm font-medium mb-1">Intervalo personalizado</Label>
                          <div className="flex gap-4">
                            <div>
                              <Label className="text-sm font-medium mb-1 block">De</Label>
                              <Input type="date" value={filters.dateFrom?.toISOString().split("T")[0] || ""} onChange={(e) => handleDateChange("from", e.target.value ? new Date(e.target.value) : null)} />
                            </div>
                            <div>
                              <Label className="text-sm font-medium mb-1 block">Até</Label>
                              <Input type="date" value={filters.dateTo?.toISOString().split("T")[0] || ""} onChange={(e) => handleDateChange("to", e.target.value ? new Date(e.target.value) : null)} />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm font-medium mb-1">Usuário</Label>
<Select 
                     value={filters.userId} 
                     onChange={(e) => handleUserChange(e.target.value)}
                   >
                        <option value="">Todos os usuários</option>
                        {/* Em uma implementação real, você buscaria a lista de usuários */}
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium mb-1">Entidade</Label>
                      <Select value={filters.entity} onChange={(e) => handleEntityChange(e.target.value)}>
                        {ENTITY_FILTERS.map(filter => (
                          <option key={filter.value} value={filter.value}>
                            {filter.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div>
                    <Label className="text-sm font-medium mb-1">Ação</Label>
                    <Select value={filters.action} onChange={(e) => handleActionChange(e.target.value)}>
                      <option value="">Todas as ações</option>
                      {ACTION_FILTERS.map(filter => (
                        <option key={filter.value} value={filter.value}>
                          {filter.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
</CardHeader>
        </Card>
        </div>
        
        <div className="col-span-1 md:col-span-3 lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Buscar</h2>
              </div>
            </CardHeader>
            <CardContent>
              <Input
                type="text"
                placeholder="Buscar por usuário, ação, entidade..."
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full mb-4"
              />
              <div className="text-xs text-muted-foreground">
                Busca em tempo real por nome do usuário, tipo de ação, entidade e outros campos.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {activities.length > 0 ? (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Atividades ({totalCount})</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableCaption className="text-left pb-2 text-sm font-medium">
                  Lista de atividades da organização
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Usuário</TableHead>
                    <TableHead className="w-20">Ação</TableHead>
                    <TableHead className="w-20">Entidade</TableHead>
                    <TableHead className="w-20">Data/Hora</TableHead>
                    <TableHead className="w-16">IP</TableHead>
                    <TableHead className="w-20">Dispositivo</TableHead>
                    {canExport && (
                      <TableHead className="w-8">Detalhes</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity.id} className="hover:bg-muted">
                      <TableCell className="flex items-center gap-3">
                        {activity.user ? (
                          <>
                            <div className="h-8 w-8 flex-shrink-0">
                              <div className="h-8 w-8 rounded-full bg-muted">
                                {activity.user.name?.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{activity.user.name ?? "Usuário desconhecido"}</div>
                              <div className="text-xs text-muted-foreground">
                                {activity.userId}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 min-w-0 text-center text-muted-foreground italic">
                            Sistema
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 flex-shrink-0 rounded-md bg-muted p-1">
                            {getActionIcon(activity.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{getActionLabel(activity.action)}</div>

                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {activity.entity}
                        </div>
                        {activity.entityId && (
                          <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                            ID: {activity.entityId}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateDisplay(activity.createdAt)}
                        <div className="text-xs">{formatTimeAgo(activity.createdAt)}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {activity.ipAddress ? (
                          <div className="flex items-center gap-1">
                            {/* Máscara de IP para exibição segura */}
                            {activity.ipAddress
                              .replace(/^::ffff:/, "")
                              .replace(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}$/, "$1x")
                              .replace(/^([0-9a-f:]+:)[0-9a-fx]+$/, "$1x")}
                          </div>
                        ) : (
                          <span className="italic">Não disponível</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatUserAgent(activity.userAgent)}
                      </TableCell>
                      {canExport && (
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" aria-label="Ver detalhes">
                            <Info className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex items-center justify-between pt-4">
              <div className="flex-1">
                {/* Simple pagination controls */}
                <div className="flex items-center gap-2 text-sm">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handlePageChange(Math.max(0, page - 1))}
                    disabled={page === 0}
                  >
                    Anterior
                  </Button>
                  <span>
                    Página {page + 1} de {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
) : (
         <Card>
           <CardHeader>
             <CardTitle>Atividade</CardTitle>
           </CardHeader>
           <CardContent className="text-center py-12">
             <p className="text-muted-foreground">
               Nenhuma atividade encontrada para os filtros selecionados.
             </p>
           </CardContent>
         </Card>
       )}
    </>
  );
};

export default ActivityClient;