import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit,
  Eye,
  FileText,
  Filter,
  LogOut,
  MessageSquarePlus,
  Paperclip,
  Search,
  Shield,
  Trash2,
  UserCog,
  Users,
  XCircle,
  BarChart3
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { queryClient } from "@/lib/queryClient";
import {
  getRequests,
  updateRequest,
  deleteRequest,
  getObservations,
  addObservation,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getDashboard,
  logout,
  getMe
} from "@/lib/api";
const statusLabel = {
  novo: "Novo",
  em_analise: "Em an\xE1lise",
  aprovado: "Aprovado",
  indeferido: "Indeferido"
};
const statusBadgeVariant = {
  novo: "secondary",
  em_analise: "outline",
  aprovado: "default",
  indeferido: "destructive"
};
function statusIcon(status) {
  switch (status) {
    case "novo":
      return <Clock className="h-4 w-4 text-slate-500" />;
    case "em_analise":
      return <Shield className="h-4 w-4 text-amber-600" />;
    case "aprovado":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "indeferido":
      return <XCircle className="h-4 w-4 text-rose-600" />;
  }
}
function Admin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getMe
  });
  useEffect(() => {
    if (userError) {
      setLocation("/admin");
    }
  }, [userError, setLocation]);
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["/api/requests"],
    queryFn: getRequests,
    enabled: !!currentUser
  });
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: getUsers,
    enabled: !!currentUser && currentUser.role === "admin"
  });
  const { data: dashboardData } = useQuery({
    queryKey: ["/api/dashboard"],
    queryFn: getDashboard,
    enabled: !!currentUser && currentUser.role === "admin"
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selected, setSelected] = useState(null);
  const [editingMode, setEditingMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [userSheetOpen, setUserSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "atendente" });
  const [newObs, setNewObs] = useState("");
  const { data: observations = [], isLoading: obsLoading } = useQuery({
    queryKey: ["/api/requests", selected?.id, "observations"],
    queryFn: () => getObservations(selected.id),
    enabled: !!selected
  });
  const updateRequestMutation = useMutation({
    mutationFn: ({ id, data }) => updateRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
    }
  });
  const deleteRequestMutation = useMutation({
    mutationFn: (id) => deleteRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
    }
  });
  const addObservationMutation = useMutation({
    mutationFn: ({ requestId, text }) => addObservation(requestId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", selected?.id, "observations"] });
    }
  });
  const createUserMutation = useMutation({
    mutationFn: (data) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    }
  });
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }
  });
  const deleteUserMutation = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    }
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      setLocation("/admin");
    }
  });
  const stats = useMemo(() => {
    const base = { novo: 0, em_analise: 0, aprovado: 0, indeferido: 0 };
    for (const r of requests) base[r.status]++;
    return base;
  }, [requests]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => statusFilter === "todos" ? true : r.status === statusFilter).filter((r) => {
      if (!q) return true;
      return r.protocolId.toLowerCase().includes(q) || r.nomeCompleto.toLowerCase().includes(q) || r.numeroProcesso.toLowerCase().includes(q) || r.partes.toLowerCase().includes(q);
    });
  }, [query, statusFilter, requests]);
  const handleSaveEdit = () => {
    if (!editForm || !selected) return;
    updateRequestMutation.mutate(
      { id: selected.id, data: editForm },
      {
        onSuccess: (updatedRequest) => {
          setSelected(updatedRequest);
          setEditingMode(false);
          toast({ title: "Solicita\xE7\xE3o atualizada" });
        }
      }
    );
  };
  const handleStatusChange = (status) => {
    if (!selected) return;
    updateRequestMutation.mutate(
      { id: selected.id, data: { status } },
      {
        onSuccess: (updatedRequest) => {
          setSelected(updatedRequest);
          toast({
            title: "Status atualizado",
            description: `A solicita\xE7\xE3o ${selected.protocolId} foi alterada para ${statusLabel[status]}.`
          });
        }
      }
    );
  };
  const handleAddObservation = () => {
    if (!selected || !newObs.trim()) return;
    addObservationMutation.mutate(
      { requestId: selected.id, text: newObs.trim() },
      {
        onSuccess: () => {
          setNewObs("");
          toast({ title: "Observa\xE7\xE3o adicionada com sucesso" });
        }
      }
    );
  };
  const handleDeleteRequest = () => {
    if (!selected) return;
    if (confirm(`Tem certeza que deseja excluir a solicita\xE7\xE3o ${selected.protocolId}?`)) {
      deleteRequestMutation.mutate(selected.id, {
        onSuccess: () => {
          setSelected(null);
          toast({ title: "Solicita\xE7\xE3o exclu\xEDda", variant: "destructive" });
        }
      });
    }
  };
  const handleExport = () => {
    const headers = ["ID", "Data", "Status", "Solicitante", "CPF", "E-mail", "WhatsApp", "Num. Processo", "Partes", "Segredo"];
    const csvContent = [
      headers.join(";"),
      ...filtered.map((r) => [
        r.protocolId,
        r.createdAt,
        r.status,
        `"${r.nomeCompleto}"`,
        r.cpf,
        r.email,
        r.whatsapp,
        `"${r.numeroProcesso}"`,
        `"${r.partes}"`,
        r.segredoJustica
      ].join(";"))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `solicitacoes_tjpe_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exporta\xE7\xE3o conclu\xEDda", description: "O arquivo CSV foi baixado." });
  };
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: `${label} copiado para a \xE1rea de transfer\xEAncia.` });
  };
  if (userLoading) {
    return <div className="min-h-screen bg-slate-50/50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-slate-500 text-lg">Carregando...</div>
        </main>
      </div>;
  }
  if (!currentUser) {
    return null;
  }
  return <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:py-10">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between bg-white p-4 rounded-xl border shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-serif text-slate-900">Administração</h1>
                    <p className="text-slate-600">Gestão de solicitações e usuários do arquivo.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Link href="/" className="text-primary hover:underline">
                    Voltar ao formulário
                  </Link>
                  <span className="text-slate-400">•</span>
                  <Button
    variant="ghost"
    size="sm"
    className="text-slate-500 hover:text-slate-700 h-auto p-0"
    onClick={() => logoutMutation.mutate()}
  >
                    <LogOut className="h-4 w-4 mr-1.5" /> Sair
                  </Button>
                </div>
              </div>
            </div>

            <Tabs defaultValue="solicitacoes" className="w-full">
              <TabsList className="mb-4 bg-white border shadow-sm w-full justify-start h-auto p-1 flex-wrap">
                <TabsTrigger value="solicitacoes" className="py-2.5 px-4 gap-2 data-[state=active]:bg-primary/5 data-[state=active]:text-primary">
                  <FileText className="h-4 w-4" />
                  Solicitações
                </TabsTrigger>
                {currentUser.role === "admin" && <>
                    <TabsTrigger value="dashboard" className="py-2.5 px-4 gap-2 data-[state=active]:bg-primary/5 data-[state=active]:text-primary">
                      <BarChart3 className="h-4 w-4" />
                      Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="usuarios" className="py-2.5 px-4 gap-2 data-[state=active]:bg-primary/5 data-[state=active]:text-primary">
                      <Users className="h-4 w-4" />
                      Usuários (Admin)
                    </TabsTrigger>
                  </>}
              </TabsList>

              <TabsContent value="solicitacoes" className="space-y-6 mt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-600 font-sans">Novos</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-2xl font-semibold text-slate-900">{stats.novo}</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-600 font-sans">Em análise</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-2xl font-semibold text-slate-900">{stats.em_analise}</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-600 font-sans">Aprovadas</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-2xl font-semibold text-slate-900">{stats.aprovado}</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-600 font-sans">Indeferidas</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-2xl font-semibold text-slate-900">{stats.indeferido}</div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="shadow-lg overflow-hidden border-t-4 border-t-primary">
                  <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <CardTitle className="text-lg font-serif text-slate-900">Filtros</CardTitle>
                      </div>

                      <div className="flex flex-col md:flex-row gap-3 md:items-center">
                        <div className="relative">
                          <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <Input
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="Buscar por protocolo, nome, processo…"
    className="pl-9 w-full md:w-[320px]"
  />
                        </div>

                        <Select
    value={statusFilter}
    onValueChange={(v) => setStatusFilter(v)}
  >
                          <SelectTrigger className="w-full md:w-[160px]">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="novo">Novo</SelectItem>
                            <SelectItem value="em_analise">Em análise</SelectItem>
                            <SelectItem value="aprovado">Aprovado</SelectItem>
                            <SelectItem value="indeferido">Indeferido</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
    type="button"
    variant="outline"
    onClick={() => {
      setQuery("");
      setStatusFilter("todos");
    }}
  >
                          Limpar
                        </Button>
                        <Button type="button" variant="secondary" className="gap-2" onClick={handleExport}>
                          <Download className="h-4 w-4" />
                          Exportar
                        </Button>
                      </div>
                    </div>

                    <div className="text-sm text-slate-500">
                      {filtered.length} solicitação(ões) encontrada(s)
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="divide-y border rounded-md">
                      {filtered.map((r) => <div
    key={r.id}
    className="w-full text-left p-4 hover:bg-slate-50 transition-colors bg-white first:rounded-t-md last:rounded-b-md cursor-pointer"
    onClick={() => setSelected(r)}
  >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-900">{r.protocolId}</span>
                                <Badge variant={statusBadgeVariant[r.status]} className="gap-1">
                                  {statusIcon(r.status)}
                                  {statusLabel[r.status]}
                                </Badge>
                                {r.segredoJustica === "sim" && <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                                    Sigilo
                                  </Badge>}
                                {r.anexoName && <Badge variant="outline" className="gap-1 bg-slate-100">
                                    <Paperclip className="h-3 w-3" /> Anexo
                                  </Badge>}
                              </div>
                              <div className="text-sm font-medium text-slate-800 truncate">
                                {r.numeroProcesso} • {r.partes}
                              </div>
                              <div className="text-xs text-slate-500">
                                {r.nomeCompleto} • Registrado em: {new Date(r.createdAt).toLocaleString("pt-BR")}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 justify-end mt-2 md:mt-0">
                              <Button
    type="button"
    variant="secondary"
    size="sm"
    className="gap-2 pointer-events-none"
  >
                                <Eye className="h-4 w-4" />
                                Detalhes
                              </Button>
                            </div>
                          </div>
                        </div>)}

                      {filtered.length === 0 && <div className="p-12 text-center text-slate-500">
                          Nenhuma solicitação corresponde aos filtros.
                        </div>}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {currentUser.role === "admin" && <>
                  <TabsContent value="dashboard" className="space-y-6 mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <Card className="col-span-1 md:col-span-2 lg:col-span-3 border-t-4 border-t-primary shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-lg font-serif">Atendimentos por Mês</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={(dashboardData?.byMonth || []).map((m) => ({ name: m.month, atendimentos: m.count }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <RechartsTooltip />
                                <Bar dataKey="atendimentos" fill="#15803d" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm border-t-4 border-t-blue-600">
                        <CardHeader>
                          <CardTitle className="text-lg font-serif">Horários de Pico</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={(dashboardData?.byHour || []).map((h) => ({ hora: h.hour, chamados: h.count }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="hora" />
                                <YAxis />
                                <RechartsTooltip />
                                <Line type="monotone" dataKey="chamados" stroke="#2563eb" strokeWidth={2} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm border-t-4 border-t-amber-500">
                        <CardHeader>
                          <CardTitle className="text-lg font-serif">Maiores Solicitantes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {(dashboardData?.topRequesters || []).map((s, i) => <div key={i} className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">{s.name}</span>
                                <Badge variant="secondary">{s.count} pedidos</Badge>
                              </div>)}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm border-t-4 border-t-purple-600">
                        <CardHeader>
                          <CardTitle className="text-lg font-serif">Atendentes Mais Ativos</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {(dashboardData?.topAttendants || []).map((a, i) => <div key={i} className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">{a.name}</span>
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  {a.count} interações
                                </Badge>
                              </div>)}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-2 gap-4">
                        <Card className="bg-slate-900 text-white">
                          <CardContent className="p-6">
                            <div className="text-sm text-slate-400 mb-1">Atendimentos Hoje</div>
                            <div className="text-3xl font-bold">{dashboardData?.today ?? 0}</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-primary text-white">
                          <CardContent className="p-6">
                            <div className="text-sm text-green-100 mb-1">Atendimentos na Semana</div>
                            <div className="text-3xl font-bold">{dashboardData?.week ?? 0}</div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="usuarios" className="space-y-6 mt-0">
                  <Card className="shadow-sm border-t-4 border-t-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg font-serif">Gerenciamento de Usuários</CardTitle>
                        <p className="text-sm text-slate-500 mt-1">Adicione ou remova permissões de acesso ao painel.</p>
                      </div>
                      <Button onClick={() => {
    setEditingUser(null);
    setUserForm({ name: "", email: "", password: "", role: "atendente" });
    setUserSheetOpen(true);
  }}>
                        <UserCog className="h-4 w-4 mr-2" />
                        Novo Usuário
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        {users.map((u) => <div key={u.id} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-slate-50">
                            <div>
                              <div className="font-medium text-slate-900 flex items-center gap-2">
                                {u.name}
                                {u.role === "admin" && <Badge variant="default" className="text-[10px] h-5">Admin</Badge>}
                                {u.role === "atendente" && <Badge variant="secondary" className="text-[10px] h-5">Atendente</Badge>}
                              </div>
                              <div className="text-sm text-slate-500">{u.email}</div>
                            </div>
                            <div className="flex gap-2">
                              <Button
    variant="outline"
    size="sm"
    onClick={() => {
      setEditingUser(u);
      setUserForm({ name: u.name, email: u.email, password: "", role: u.role });
      setUserSheetOpen(true);
    }}
  >
                                <Edit className="h-4 w-4 mr-1" /> Editar
                              </Button>
                              <Select
    value={u.role}
    onValueChange={(val) => {
      updateUserMutation.mutate(
        { id: u.id, data: { role: val } },
        {
          onSuccess: () => {
            toast({ title: "Perfil atualizado" });
          }
        }
      );
    }}
  >
                                <SelectTrigger className="w-[130px] h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Administrador</SelectItem>
                                  <SelectItem value="atendente">Atendente</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
    variant="outline"
    size="icon"
    className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
    onClick={() => {
      if (users.length === 1) return alert("N\xE3o \xE9 poss\xEDvel remover o \xFAnico usu\xE1rio.");
      if (confirm("Remover usu\xE1rio?")) {
        deleteUserMutation.mutate(u.id, {
          onSuccess: () => {
            toast({ title: "Usu\xE1rio removido" });
          }
        });
      }
    }}
  >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>)}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </>}
            </Tabs>

            <Sheet open={!!selected} onOpenChange={(open) => !open ? (setSelected(null), setEditingMode(false)) : null}>
              <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
                {selected && <>
                    <SheetHeader className="mb-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <SheetTitle className="font-serif text-2xl flex items-center gap-3">
                            {selected.protocolId}
                            <Badge variant={statusBadgeVariant[selected.status]} className="text-sm">
                              {statusLabel[selected.status]}
                            </Badge>
                          </SheetTitle>
                          <SheetDescription className="mt-1 text-slate-500">
                            Registrado em {new Date(selected.createdAt).toLocaleString("pt-BR")}
                          </SheetDescription>
                        </div>
                        {currentUser.role === "admin" && !editingMode && <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
    setEditForm({
      nomeCompleto: selected.nomeCompleto,
      cpf: selected.cpf,
      whatsapp: selected.whatsapp,
      email: selected.email,
      oab: selected.oab,
      tipoNumeracao: selected.tipoNumeracao,
      numeroProcesso: selected.numeroProcesso,
      partes: selected.partes,
      segredoJustica: selected.segredoJustica,
      observacao: selected.observacao
    });
    setEditingMode(true);
  }}>
                              <Edit className="h-4 w-4 mr-2" /> Editar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={handleDeleteRequest}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </Button>
                          </div>}
                        {editingMode && <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingMode(false)}>
                              Cancelar
                            </Button>
                            <Button variant="default" size="sm" onClick={handleSaveEdit}>
                              Salvar alterações
                            </Button>
                          </div>}
                      </div>
                    </SheetHeader>

                    <div className="space-y-6">
                      {
    /* Process Info First (Most important for search) */
  }
                      <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
                        <div className="bg-primary/5 px-4 py-3 border-b flex items-center gap-2">
                          <Search className="h-4 w-4 text-primary" />
                          <div className="text-sm font-semibold text-primary">Dados para Busca de Processo</div>
                        </div>
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <div className="text-xs text-slate-500">Número do processo</div>
                              {editingMode && editForm ? <Input
    value={editForm.numeroProcesso || ""}
    onChange={(e) => setEditForm({ ...editForm, numeroProcesso: e.target.value })}
    className="h-8 text-sm font-semibold"
  /> : <div className="flex items-center gap-2">
                                  <span className="text-base font-semibold text-slate-900">{selected.numeroProcesso}</span>
                                  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6"
    onClick={() => copyToClipboard(selected.numeroProcesso, "N\xFAmero")}
    title="Copiar número"
  >
                                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                                  </Button>
                                </div>}
                            </div>
                            <div className="space-y-1.5">
                              <div className="text-xs text-slate-500">Tipo de numeração</div>
                              {editingMode && editForm ? <Select
    value={editForm.tipoNumeracao || ""}
    onValueChange={(v) => setEditForm({ ...editForm, tipoNumeracao: v })}
  >
                                  <SelectTrigger className="h-8 text-sm uppercase"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="npu">NPU</SelectItem>
                                    <SelectItem value="tombo">Tombo</SelectItem>
                                  </SelectContent>
                                </Select> : <div className="text-sm font-medium text-slate-900 uppercase">
                                  {selected.tipoNumeracao}
                                </div>}
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <div className="text-xs text-slate-500">Partes</div>
                            {editingMode && editForm ? <Input
    value={editForm.partes || ""}
    onChange={(e) => setEditForm({ ...editForm, partes: e.target.value })}
    className="h-8 text-sm"
  /> : <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-900">{selected.partes}</span>
                                <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6"
    onClick={() => copyToClipboard(selected.partes, "Partes")}
    title="Copiar partes"
  >
                                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                                </Button>
                              </div>}
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <div className="text-xs text-slate-500">Segredo de Justiça</div>
                              {editingMode && editForm ? <Select
    value={editForm.segredoJustica || ""}
    onValueChange={(v) => setEditForm({ ...editForm, segredoJustica: v })}
  >
                                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sim">Sim</SelectItem>
                                    <SelectItem value="nao">Não</SelectItem>
                                  </SelectContent>
                                </Select> : <div className="text-sm text-slate-900">
                                  {selected.segredoJustica === "sim" ? <span className="text-amber-600 font-medium flex items-center gap-1">
                                      <Shield className="h-4 w-4" /> Sim
                                    </span> : "N\xE3o"}
                                </div>}
                            </div>
                            {(selected.observacao || editingMode) && <div className="space-y-1.5">
                                <div className="text-xs text-slate-500">Observação do Solicitante</div>
                                {editingMode && editForm ? <Input
    value={editForm.observacao || ""}
    onChange={(e) => setEditForm({ ...editForm, observacao: e.target.value })}
    className="h-8 text-sm"
    placeholder="Nenhuma observação"
  /> : <div className="text-sm text-slate-700 italic">"{selected.observacao}"</div>}
                              </div>}
                          </div>
                        </div>
                      </div>

                      {
    /* Requester Info */
  }
                      <div className="rounded-lg border bg-white shadow-sm">
                        <div className="px-4 py-3 border-b bg-slate-50">
                          <div className="text-sm font-semibold text-slate-900">Dados do Solicitante</div>
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">Nome Completo</div>
                            {editingMode && editForm ? <Input
    value={editForm.nomeCompleto || ""}
    onChange={(e) => setEditForm({ ...editForm, nomeCompleto: e.target.value })}
    className="h-8 text-sm"
  /> : <div className="text-sm text-slate-900">{selected.nomeCompleto}</div>}
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">CPF</div>
                            {editingMode && editForm ? <Input
    value={editForm.cpf || ""}
    onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })}
    className="h-8 text-sm"
  /> : <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-900">{selected.cpf}</span>
                                <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6"
    onClick={() => copyToClipboard(selected.cpf, "CPF")}
  >
                                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                                </Button>
                              </div>}
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">WhatsApp</div>
                            {editingMode && editForm ? <Input
    value={editForm.whatsapp || ""}
    onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
    className="h-8 text-sm"
  /> : <div className="text-sm text-slate-900">{selected.whatsapp}</div>}
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">E-mail</div>
                            {editingMode && editForm ? <Input
    value={editForm.email || ""}
    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
    className="h-8 text-sm"
  /> : <div className="text-sm text-slate-900">{selected.email}</div>}
                          </div>
                          {(selected.oab || editingMode) && <div className="space-y-1">
                              <div className="text-xs text-slate-500">OAB (Advogado)</div>
                              {editingMode && editForm ? <Input
    value={editForm.oab || ""}
    onChange={(e) => setEditForm({ ...editForm, oab: e.target.value })}
    className="h-8 text-sm"
    placeholder="Opcional"
  /> : <div className="text-sm font-medium text-slate-900">{selected.oab}</div>}
                            </div>}
                        </div>
                      </div>

                      {
    /* Attachment */
  }
                      <div className="rounded-lg border bg-white shadow-sm">
                        <div className="px-4 py-3 border-b bg-slate-50">
                          <div className="text-sm font-semibold text-slate-900">Procuração / Documento</div>
                        </div>
                        <div className="p-4">
                          {selected.anexoName ? <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="bg-primary/10 p-2 rounded-full">
                                  <Paperclip className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-slate-900 truncate">
                                    {selected.anexoName}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {selected.anexoType} • {selected.anexoSize} KB
                                  </div>
                                </div>
                              </div>
                              <Button
    type="button"
    variant="outline"
    className="gap-2 shrink-0"
    onClick={() => {
      toast({ title: "Download iniciado", description: "O arquivo est\xE1 sendo baixado." });
    }}
  >
                                <Download className="h-4 w-4" />
                                Baixar
                              </Button>
                            </div> : <div className="text-sm text-slate-500 italic p-2 bg-slate-50 rounded-md text-center border border-dashed">
                              Nenhum anexo foi enviado nesta solicitação.
                            </div>}
                        </div>
                      </div>

                      {
    /* Observations & Internal Notes */
  }
                      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b bg-amber-50/50">
                          <div className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                            <MessageSquarePlus className="h-4 w-4" /> Observações Internas
                          </div>
                        </div>
                        <div className="p-4 space-y-4">
                          {obsLoading ? <div className="text-sm text-slate-500 text-center py-2">
                              Carregando observações...
                            </div> : observations.length > 0 ? <div className="space-y-3">
                              {observations.map((obs) => <div key={obs.id} className="bg-slate-50 border p-3 rounded-md text-sm">
                                  <div className="text-slate-800">{obs.text}</div>
                                  <div className="text-xs text-slate-500 mt-2 flex justify-between">
                                    <span className="font-medium">{obs.authorName} ({obs.authorRole === "admin" ? "Admin" : "Atendente"})</span>
                                    <span>{new Date(obs.createdAt).toLocaleString("pt-BR")}</span>
                                  </div>
                                </div>)}
                            </div> : <div className="text-sm text-slate-500 text-center py-2">
                              Nenhuma observação registrada ainda.
                            </div>}
                          
                          <div className="space-y-2 mt-4 pt-4 border-t">
                            <label className="text-sm font-medium text-slate-700">Nova observação</label>
                            <Textarea
    placeholder="Digite uma nota sobre o andamento..."
    value={newObs}
    onChange={(e) => setNewObs(e.target.value)}
    className="resize-none"
  />
                            <div className="flex justify-end">
                              <Button size="sm" onClick={handleAddObservation} disabled={!newObs.trim() || addObservationMutation.isPending}>
                                Adicionar Nota
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {
    /* Status Change Actions */
  }
                      <div className="rounded-lg border bg-slate-900 text-white shadow-sm p-5">
                        <h3 className="text-sm font-medium mb-4 text-slate-300">Ações de Mudança de Status</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Button
    variant={selected.status === "novo" ? "secondary" : "outline"}
    className={selected.status !== "novo" ? "border-slate-700 hover:bg-slate-800 text-slate-300" : ""}
    onClick={() => handleStatusChange("novo")}
  >
                            <Clock className="h-4 w-4 mr-2" /> Novo
                          </Button>
                          <Button
    variant={selected.status === "em_analise" ? "secondary" : "outline"}
    className={selected.status !== "em_analise" ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "bg-amber-600 hover:bg-amber-700 text-white"}
    onClick={() => handleStatusChange("em_analise")}
  >
                            <Shield className="h-4 w-4 mr-2" /> Em análise
                          </Button>
                          <Button
    variant={selected.status === "aprovado" ? "secondary" : "outline"}
    className={selected.status !== "aprovado" ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
    onClick={() => handleStatusChange("aprovado")}
  >
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
                          </Button>
                          <Button
    variant={selected.status === "indeferido" ? "secondary" : "outline"}
    className={selected.status !== "indeferido" ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "bg-rose-600 hover:bg-rose-700 text-white"}
    onClick={() => handleStatusChange("indeferido")}
  >
                            <XCircle className="h-4 w-4 mr-2" /> Indeferir
                          </Button>
                        </div>
                      </div>

                    </div>
                  </>}
              </SheetContent>
            </Sheet>
          </div>

          <Sheet open={userSheetOpen} onOpenChange={setUserSheetOpen}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-serif text-xl">
                  {editingUser ? "Editar Usu\xE1rio" : "Novo Usu\xE1rio"}
                </SheetTitle>
                <SheetDescription>
                  Preencha os dados do usuário abaixo.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome Completo</label>
                  <Input
    value={userForm.name}
    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
    placeholder="João Silva"
  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">E-mail</label>
                  <Input
    type="email"
    value={userForm.email}
    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
    placeholder="usuario@tjpe.jus.br"
  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Senha {editingUser && <span className="text-slate-500 font-normal">(deixe em branco para manter)</span>}
                  </label>
                  <Input
    type="password"
    value={userForm.password}
    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
    placeholder="***"
  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Perfil</label>
                  <Select
    value={userForm.role}
    onValueChange={(val) => setUserForm({ ...userForm, role: val })}
  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="atendente">Atendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setUserSheetOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => {
    if (!userForm.name || !userForm.email || !editingUser && !userForm.password) {
      toast({ title: "Preencha os campos obrigat\xF3rios", variant: "destructive" });
      return;
    }
    if (editingUser) {
      const data = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role
      };
      if (userForm.password) {
        data.password = userForm.password;
      }
      updateUserMutation.mutate(
        { id: editingUser.id, data },
        {
          onSuccess: () => {
            toast({ title: "Usu\xE1rio atualizado com sucesso" });
            setUserSheetOpen(false);
          }
        }
      );
    } else {
      createUserMutation.mutate(
        {
          name: userForm.name,
          email: userForm.email,
          password: userForm.password,
          role: userForm.role
        },
        {
          onSuccess: () => {
            toast({ title: "Usu\xE1rio adicionado com sucesso" });
            setUserSheetOpen(false);
          }
        }
      );
    }
  }}>
                    Salvar
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

        </div>
      </main>
    </div>;
}
export {
  Admin as default
};
