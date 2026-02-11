import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Paperclip,
  Search,
  Shield,
  XCircle,
} from "lucide-react";

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
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type RequestStatus = "novo" | "em_analise" | "aprovado" | "indeferido";

type RequestItem = {
  id: string;
  createdAt: string;
  status: RequestStatus;
  solicitante: {
    nome: string;
    cpf: string;
    whatsapp: string;
    email: string;
    oab?: string;
  };
  processo: {
    tipoNumeracao: "npu" | "tombo";
    numero: string;
    partes: string;
    segredoJustica: "sim" | "nao";
    observacao?: string;
  };
  anexo?: {
    name: string;
    sizeKB: number;
    type: string;
  };
};

const statusLabel: Record<RequestStatus, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  indeferido: "Indeferido",
};

const statusBadgeVariant: Record<RequestStatus, "default" | "secondary" | "outline" | "destructive"> = {
  novo: "secondary",
  em_analise: "outline",
  aprovado: "default",
  indeferido: "destructive",
};

function statusIcon(status: RequestStatus) {
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

const mockRequests: RequestItem[] = [
  {
    id: "AG-000184",
    createdAt: "2026-02-11 10:42",
    status: "novo",
    solicitante: {
      nome: "Maria Eduarda Santos",
      cpf: "***.***.***-**",
      whatsapp: "(81) 9****-****",
      email: "maria.santos@exemplo.com",
      oab: "12345-PE",
    },
    processo: {
      tipoNumeracao: "npu",
      numero: "0000000-00.0000.8.17.0000",
      partes: "João da Silva x Empresa X",
      segredoJustica: "nao",
      observacao: "Solicito prioridade por prazo processual.",
    },
    anexo: {
      name: "procuracao.pdf",
      sizeKB: 842,
      type: "application/pdf",
    },
  },
  {
    id: "AG-000183",
    createdAt: "2026-02-11 09:17",
    status: "em_analise",
    solicitante: {
      nome: "Carlos Henrique Lima",
      cpf: "***.***.***-**",
      whatsapp: "(81) 9****-****",
      email: "carlos.lima@exemplo.com",
    },
    processo: {
      tipoNumeracao: "tombo",
      numero: "TOMBO-1998-02193",
      partes: "Estado de Pernambuco x Fulano de Tal",
      segredoJustica: "sim",
    },
  },
  {
    id: "AG-000182",
    createdAt: "2026-02-10 16:08",
    status: "aprovado",
    solicitante: {
      nome: "Ana Paula Ribeiro",
      cpf: "***.***.***-**",
      whatsapp: "(81) 9****-****",
      email: "ana.ribeiro@exemplo.com",
    },
    processo: {
      tipoNumeracao: "npu",
      numero: "0001111-22.2011.8.17.0001",
      partes: "Beltrano x Sicrano",
      segredoJustica: "nao",
      observacao: "Consulta para fins de pesquisa.",
    },
    anexo: {
      name: "habilitacao.jpg",
      sizeKB: 311,
      type: "image/jpeg",
    },
  },
  {
    id: "AG-000181",
    createdAt: "2026-02-10 11:26",
    status: "indeferido",
    solicitante: {
      nome: "Rafael Oliveira",
      cpf: "***.***.***-**",
      whatsapp: "(81) 9****-****",
      email: "rafael.oliveira@exemplo.com",
    },
    processo: {
      tipoNumeracao: "tombo",
      numero: "ANT-2003-00044",
      partes: "Fulano x Banco Y",
      segredoJustica: "nao",
      observacao: "Dados insuficientes para localizar o processo.",
    },
  },
];

export default function Admin() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "todos">("todos");
  const [selected, setSelected] = useState<RequestItem | null>(null);

  const stats = useMemo(() => {
    const base = { novo: 0, em_analise: 0, aprovado: 0, indeferido: 0 } as Record<RequestStatus, number>;
    for (const r of mockRequests) base[r.status]++;
    return base;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mockRequests
      .filter((r) => (statusFilter === "todos" ? true : r.status === statusFilter))
      .filter((r) => {
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r.solicitante.nome.toLowerCase().includes(q) ||
          r.processo.numero.toLowerCase().includes(q) ||
          r.processo.partes.toLowerCase().includes(q)
        );
      });
  }, [query, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:py-10">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-serif text-slate-900" data-testid="text-admin-title">Administração</h1>
                    <p className="text-slate-600" data-testid="text-admin-subtitle">
                      Verifique e analise as solicitações recebidas.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Link href="/">
                    <a className="text-primary hover:underline" data-testid="link-back-home">Voltar ao formulário</a>
                  </Link>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500" data-testid="text-admin-disclaimer">Dados exibidos: demonstração (mock)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:flex md:items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="justify-center"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("todos");
                  }}
                  data-testid="button-clear-filters"
                >
                  <Filter className="h-4 w-4" />
                  Limpar
                </Button>
                <Button type="button" className="justify-center" data-testid="button-export">
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-600 font-sans" data-testid="text-stat-novo-label">Novos</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-semibold text-slate-900" data-testid="text-stat-novo">{stats.novo}</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-600 font-sans" data-testid="text-stat-analise-label">Em análise</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-semibold text-slate-900" data-testid="text-stat-analise">{stats.em_analise}</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-600 font-sans" data-testid="text-stat-aprovado-label">Aprovadas</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-semibold text-slate-900" data-testid="text-stat-aprovado">{stats.aprovado}</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-600 font-sans" data-testid="text-stat-indeferido-label">Indeferidas</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-semibold text-slate-900" data-testid="text-stat-indeferido">{stats.indeferido}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-lg overflow-hidden border-t-4 border-t-primary">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-600" />
                    <CardTitle className="text-lg font-serif text-slate-900" data-testid="text-admin-list-title">Solicitações</CardTitle>
                  </div>

                  <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="relative">
                      <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por protocolo, nome, número do processo…"
                        className="pl-9 w-full md:w-[360px]"
                        data-testid="input-search"
                      />
                    </div>

                    <Select
                      value={statusFilter}
                      onValueChange={(v) => setStatusFilter(v as RequestStatus | "todos")}
                    >
                      <SelectTrigger className="w-full md:w-[190px]" data-testid="select-status">
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
                  </div>
                </div>

                <div className="text-sm text-slate-500" data-testid="text-admin-results">
                  {filtered.length} resultado(s)
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="divide-y">
                  {filtered.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="w-full text-left py-4 px-1 md:px-2 hover:bg-slate-50 transition-colors rounded-md"
                      onClick={() => setSelected(r)}
                      data-testid={`row-request-${r.id}`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900" data-testid={`text-request-id-${r.id}`}>{r.id}</span>
                            <Badge variant={statusBadgeVariant[r.status]} className="gap-1" data-testid={`badge-status-${r.id}`}>
                              {statusIcon(r.status)}
                              {statusLabel[r.status]}
                            </Badge>
                            {r.processo.segredoJustica === "sim" ? (
                              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50" data-testid={`badge-sigilo-${r.id}`}>
                                Sigilo
                              </Badge>
                            ) : null}
                            {r.anexo ? (
                              <Badge variant="outline" className="gap-1" data-testid={`badge-anexo-${r.id}`}>
                                <Paperclip className="h-3.5 w-3.5" />
                                Anexo
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-sm text-slate-600 truncate" data-testid={`text-request-summary-${r.id}`}>
                            {r.processo.numero} • {r.processo.partes}
                          </div>
                          <div className="text-xs text-slate-500" data-testid={`text-request-meta-${r.id}`}>
                            {r.solicitante.nome} • {r.createdAt}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelected(r);
                            }}
                            data-testid={`button-view-${r.id}`}
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Button>
                        </div>
                      </div>
                    </button>
                  ))}

                  {filtered.length === 0 ? (
                    <div className="py-10 text-center text-slate-600" data-testid="text-empty">
                      Nenhuma solicitação encontrada com os filtros atuais.
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Sheet open={!!selected} onOpenChange={(open) => (!open ? setSelected(null) : null)}>
              <SheetContent className="w-full sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle className="font-serif" data-testid="text-sheet-title">Detalhes da solicitação</SheetTitle>
                  <SheetDescription data-testid="text-sheet-subtitle">
                    Visualize os dados e registre sua análise.
                  </SheetDescription>
                </SheetHeader>

                {selected ? (
                  <div className="mt-6 space-y-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold text-slate-900" data-testid="text-sheet-id">{selected.id}</span>
                          <Badge variant={statusBadgeVariant[selected.status]} className="gap-1" data-testid="badge-sheet-status">
                            {statusIcon(selected.status)}
                            {statusLabel[selected.status]}
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-500" data-testid="text-sheet-created">{selected.createdAt}</div>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-white">
                      <div className="px-4 py-3 border-b">
                        <div className="text-sm font-semibold text-slate-900" data-testid="text-section-solicitante">Dados do solicitante</div>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500">Nome</div>
                          <div className="text-sm text-slate-900" data-testid="text-sheet-nome">{selected.solicitante.nome}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500">CPF</div>
                          <div className="text-sm text-slate-900" data-testid="text-sheet-cpf">{selected.solicitante.cpf}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500">WhatsApp</div>
                          <div className="text-sm text-slate-900" data-testid="text-sheet-whatsapp">{selected.solicitante.whatsapp}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500">E-mail</div>
                          <div className="text-sm text-slate-900" data-testid="text-sheet-email">{selected.solicitante.email}</div>
                        </div>
                        {selected.solicitante.oab ? (
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">OAB</div>
                            <div className="text-sm text-slate-900" data-testid="text-sheet-oab">{selected.solicitante.oab}</div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-white">
                      <div className="px-4 py-3 border-b">
                        <div className="text-sm font-semibold text-slate-900" data-testid="text-section-processo">Dados do processo</div>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">Tipo de numeração</div>
                            <div className="text-sm text-slate-900" data-testid="text-sheet-tipo">
                              {selected.processo.tipoNumeracao === "npu" ? "NPU" : "Tombo"}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">Segredo de Justiça</div>
                            <div className="text-sm text-slate-900" data-testid="text-sheet-sigilo">
                              {selected.processo.segredoJustica === "sim" ? "Sim" : "Não"}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500">Número do processo</div>
                          <div className="text-sm font-medium text-slate-900" data-testid="text-sheet-numero">{selected.processo.numero}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500">Partes</div>
                          <div className="text-sm text-slate-900" data-testid="text-sheet-partes">{selected.processo.partes}</div>
                        </div>
                        {selected.processo.observacao ? (
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">Observação</div>
                            <div className="text-sm text-slate-900" data-testid="text-sheet-obs">{selected.processo.observacao}</div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-white">
                      <div className="px-4 py-3 border-b">
                        <div className="text-sm font-semibold text-slate-900" data-testid="text-section-anexo">Anexo</div>
                      </div>
                      <div className="p-4">
                        {selected.anexo ? (
                          <div className="flex items-center justify-between gap-3 rounded-md border bg-slate-50 px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 truncate" data-testid="text-sheet-file-name">
                                {selected.anexo.name}
                              </div>
                              <div className="text-xs text-slate-500" data-testid="text-sheet-file-meta">
                                {selected.anexo.type} • {selected.anexo.sizeKB} KB
                              </div>
                            </div>
                            <Button type="button" variant="outline" className="gap-2" data-testid="button-download">
                              <Download className="h-4 w-4" />
                              Baixar
                            </Button>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-600" data-testid="text-sheet-no-attachment">
                            Nenhum anexo enviado.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-white">
                      <div className="px-4 py-3 border-b">
                        <div className="text-sm font-semibold text-slate-900" data-testid="text-section-analise">Análise</div>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Button type="button" variant="outline" data-testid="button-set-analise">
                            Marcar em análise
                          </Button>
                          <Button type="button" data-testid="button-set-aprovado">
                            Aprovar
                          </Button>
                          <Button type="button" variant="destructive" data-testid="button-set-indeferido">
                            Indeferir
                          </Button>
                          <Button type="button" variant="secondary" data-testid="button-add-note">
                            Registrar observação
                          </Button>
                        </div>
                        <div className="text-xs text-slate-500" data-testid="text-analise-note">
                          Nesta versão de protótipo, os botões apenas demonstram a interface (sem persistência).
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setSelected(null)} data-testid="button-close-sheet">
                        Fechar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </main>
    </div>
  );
}
