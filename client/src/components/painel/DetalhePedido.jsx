import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileCheck2, MessageSquarePlus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { api, fmtData, roleLabel, statusLabel } from "@/lib/painel";
import { ACOES, CERTIDAO_TIPOS } from "@shared/workflow.js";
import { StatusBadge } from "./ListaPedidos";
import { AcaoDialog } from "./AcaoDialog";

const NOMES_ACAO = { solicitar: "Solicitação registrada", emitir_certidao: "Certidão emitida" };

function Campo({ rotulo, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{rotulo}</dt>
      <dd className="text-sm text-slate-900 break-words">{children || "—"}</dd>
    </div>
  );
}

function Secao({ titulo, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 border-b pb-1">{titulo}</h3>
      {children}
    </section>
  );
}

export function DetalhePedido({ pedidoId, onClose }) {
  const { toast } = useToast();
  const [acao, setAcao] = useState(null);
  const [obs, setObs] = useState("");
  const aberto = !!pedidoId;

  const det = useQuery({ queryKey: ["/api/requests", pedidoId], enabled: aberto, staleTime: 0 });
  const observacoes = useQuery({
    queryKey: ["/api/requests", pedidoId, "observations"],
    enabled: aberto,
    staleTime: 0
  });
  const p = det.data;

  const addObs = useMutation({
    mutationFn: () => api("POST", `/api/requests/${pedidoId}/observations`, { text: obs }),
    onSuccess: () => {
      setObs("");
      queryClient.invalidateQueries({ queryKey: ["/api/requests", pedidoId, "observations"] });
    }
  });
  const emitir = useMutation({
    mutationFn: (tipo) => api("POST", `/api/requests/${pedidoId}/certidoes`, { tipo }),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", pedidoId] });
      toast({ title: "Certidão emitida", description: c.numero });
      window.open(`/certidao/${c.id}`, "_blank", "noopener");
    }
  });

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {!p ? (
          <SheetHeader>
            <SheetTitle>Pedido</SheetTitle>
            <SheetDescription role="status">{det.isError ? "Não foi possível abrir o pedido." : "Carregando…"}</SheetDescription>
          </SheetHeader>
        ) : (
          <div className="space-y-6 pb-10">
            <SheetHeader>
              <SheetTitle className="font-serif text-2xl flex flex-wrap items-center gap-3">
                {p.protocolId} <StatusBadge status={p.status} />
              </SheetTitle>
              <SheetDescription>Registrado em {fmtData(p.createdAt)} · atualizado em {fmtData(p.updatedAt)}</SheetDescription>
            </SheetHeader>

            {p.acoes.length > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="text-sm font-medium text-slate-900">Próximo passo</div>
                <div className="flex flex-wrap gap-2">
                  {p.acoes.map((a) => (
                    <Button key={a} size="sm" variant={ACOES[a].perigo ? "outline" : "default"} onClick={() => setAcao(a)}>
                      {ACOES[a].label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {(p.motivo || p.localizacaoFisica) && (
              <dl className="grid gap-3 sm:grid-cols-2 rounded-lg bg-slate-50 p-3">
                {p.motivo && <Campo rotulo="Motivo">{p.motivo}</Campo>}
                {p.localizacaoFisica && <Campo rotulo="Localização física">{p.localizacaoFisica}</Campo>}
              </dl>
            )}

            <Secao titulo="Processo">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo={p.tipoNumeracao === "npu" ? "Número (NPU)" : "Número de tombo"}>{p.numeroProcesso}</Campo>
                <Campo rotulo="Segredo de justiça">{p.segredoJustica === "sim" ? "Sim" : "Não"}</Campo>
                <Campo rotulo="Partes">{p.partes}</Campo>
                <Campo rotulo="Comarca · Vara/Unidade">
                  {p.comarca} · {p.varaUnidade}
                </Campo>
                {p.observacao && <Campo rotulo="Observação do solicitante">{p.observacao}</Campo>}
              </dl>
            </Secao>

            {"cpf" in p && (
              <Secao titulo="Solicitante">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Nome">{p.nomeCompleto}</Campo>
                  <Campo rotulo="CPF">{p.cpf}</Campo>
                  <Campo rotulo="OAB">{p.oab}</Campo>
                  <Campo rotulo="E-mail">{p.email}</Campo>
                  <Campo rotulo="WhatsApp">{p.whatsapp}</Campo>
                  <Campo rotulo="Procuração">
                    {p.anexoName ? (
                      <Button asChild size="sm" variant="outline" className="gap-1.5 mt-1">
                        <a href={`/api/requests/${p.id}/anexo`}>
                          <Download className="h-4 w-4" aria-hidden="true" /> {p.anexoName} ({p.anexoSize} KB)
                        </a>
                      </Button>
                    ) : (
                      "Não anexada"
                    )}
                  </Campo>
                </dl>
              </Secao>
            )}

            <Secao titulo="Responsáveis">
              <dl className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Atendimento (triagem)">{p.atendimentoResponsavel}</Campo>
                <Campo rotulo="Busca">{p.buscaResponsavel}</Campo>
                <Campo rotulo="Arquivamento">{p.arquivamentoResponsavel}</Campo>
              </dl>
            </Secao>

            {(p.certidoes.length > 0 || p.certidoesPermitidas.length > 0) && (
              <Secao titulo="Certidões">
                {p.certidoes.length > 0 && (
                  <ul className="space-y-1">
                    {p.certidoes.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          {CERTIDAO_TIPOS[c.tipo]?.label} <strong>{c.numero}</strong> · {fmtData(c.emitidaEm)} · {c.emitidaPor}
                        </span>
                        <a
                          href={`/certidao/${c.id}`}
                          target="_blank"
                          rel="noopener"
                          className="text-primary text-sm inline-flex items-center gap-1 hover:underline"
                        >
                          Abrir / imprimir <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {p.certidoesPermitidas.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {p.certidoesPermitidas.map((t) => (
                      <Button
                        key={t}
                        size="sm"
                        variant="secondary"
                        className="gap-1.5"
                        disabled={emitir.isPending}
                        onClick={() => emitir.mutate(t)}
                      >
                        <FileCheck2 className="h-4 w-4" aria-hidden="true" /> Emitir {CERTIDAO_TIPOS[t].label}
                      </Button>
                    ))}
                  </div>
                )}
              </Secao>
            )}

            <Secao titulo="Linha do tempo">
              <ol className="relative border-l border-slate-200 ml-2 space-y-4">
                {p.timeline.map((e) => (
                  <li key={e.id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-primary" aria-hidden="true" />
                    <div className="text-sm font-medium text-slate-900">
                      {ACOES[e.acao]?.label || NOMES_ACAO[e.acao] || e.acao}
                      {e.statusDe !== e.statusPara && <span className="font-normal text-slate-600"> → {statusLabel(e.statusPara)}</span>}
                    </div>
                    <div className="text-xs text-slate-600">
                      {fmtData(e.createdAt)} · {e.userName}
                      {e.userRole !== "publico" ? ` (${roleLabel(e.userRole)})` : ""}
                    </div>
                    {e.nota && <div className="text-sm text-slate-700 mt-0.5">{e.nota}</div>}
                  </li>
                ))}
              </ol>
            </Secao>

            <Secao titulo="Observações internas">
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (obs.trim()) addObs.mutate();
                }}
              >
                <label htmlFor="nova-obs" className="sr-only">
                  Nova observação
                </label>
                <Textarea id="nova-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} maxLength={2000} placeholder="Registrar observação…" />
                <Button type="submit" size="sm" variant="outline" className="gap-1.5" disabled={!obs.trim() || addObs.isPending}>
                  <MessageSquarePlus className="h-4 w-4" aria-hidden="true" /> Adicionar
                </Button>
              </form>
              <ul className="space-y-2">
                {(observacoes.data || []).map((o) => (
                  <li key={o.id} className="rounded-md bg-slate-50 p-2 text-sm">
                    <div className="text-slate-800 whitespace-pre-wrap">{o.text}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {o.authorName} ({roleLabel(o.authorRole)}) · {fmtData(o.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            </Secao>

            <AcaoDialog pedido={p} acao={acao} onClose={() => setAcao(null)} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
