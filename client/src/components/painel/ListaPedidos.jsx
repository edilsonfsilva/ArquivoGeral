import { Paperclip, Lock, User, Search as SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtData, statusLabel, statusClasse } from "@/lib/painel";

export function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={`font-sans text-xs font-medium ${statusClasse(status)}`}>
      {statusLabel(status)}
    </Badge>
  );
}

/** Lista acessível de pedidos (linhas clicáveis por mouse e teclado). */
export function ListaPedidos({ pedidos, carregando, erro, onRetry, onAbrir, vazio = "Nenhum pedido nesta fila." }) {
  if (carregando) return <p className="p-6 text-sm text-slate-500" role="status">Carregando pedidos…</p>;
  if (erro)
    return (
      <div className="p-6 text-sm text-red-700 flex items-center gap-3" role="alert">
        Não foi possível carregar os pedidos.
        <Button size="sm" variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    );
  if (!pedidos.length) return <p className="p-6 text-sm text-slate-500">{vazio}</p>;
  return (
    <ul className="divide-y border rounded-md bg-white" aria-label="Pedidos">
      {pedidos.map((r) => (
        <li key={r.id}>
          <div
            role="button"
            tabIndex={0}
            aria-label={`Abrir pedido ${r.protocolId}, ${statusLabel(r.status)}`}
            className="p-4 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
            onClick={() => onAbrir(r)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAbrir(r);
              }
            }}
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{r.protocolId}</span>
                  <StatusBadge status={r.status} />
                  {r.segredoJustica === "sim" && (
                    <Badge variant="outline" className="text-xs gap-1 text-amber-800 border-amber-200 bg-amber-50">
                      <Lock className="h-3 w-3" aria-hidden="true" /> Segredo de justiça
                    </Badge>
                  )}
                  {r.anexoName && (
                    <Badge variant="outline" className="text-xs gap-1 bg-slate-50">
                      <Paperclip className="h-3 w-3" aria-hidden="true" /> Procuração
                    </Badge>
                  )}
                </div>
                <div className="text-sm font-medium text-slate-800 truncate">
                  {r.numeroProcesso} · {r.partes}
                </div>
                <div className="text-xs text-slate-600">
                  {r.comarca} · {r.varaUnidade}
                </div>
              </div>
              <div className="text-xs text-slate-600 md:text-right space-y-0.5 shrink-0">
                {r.nomeCompleto && (
                  <div className="flex md:justify-end items-center gap-1">
                    <User className="h-3 w-3" aria-hidden="true" /> {r.nomeCompleto}
                    {r.oab ? ` (OAB ${r.oab})` : ""}
                  </div>
                )}
                {r.atendimentoResponsavel && <div>Atendimento: {r.atendimentoResponsavel}</div>}
                {(r.buscaResponsavel || r.arquivamentoResponsavel) && (
                  <div className="flex md:justify-end items-center gap-1">
                    <SearchIcon className="h-3 w-3" aria-hidden="true" />
                    Busca: {r.buscaResponsavel || "—"}
                    {r.arquivamentoResponsavel && r.arquivamentoResponsavel !== r.buscaResponsavel
                      ? ` · Arquivamento: ${r.arquivamentoResponsavel}`
                      : ""}
                  </div>
                )}
                <div>Atualizado: {fmtData(r.updatedAt)}</div>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
