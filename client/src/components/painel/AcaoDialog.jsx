import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { api, roleLabel, statusLabel } from "@/lib/painel";
import { ACOES } from "@shared/workflow.js";

/** Confirma uma ação do fluxo e coleta os dados que ela exige (motivo, responsável, localização). */
export function AcaoDialog({ pedido, acao, onClose }) {
  const def = acao ? ACOES[acao] : null;
  const { toast } = useToast();
  const exige = (c) => def?.exige.includes(c);
  const pedeResponsavel = exige("responsavelId");
  const pedeLocal = exige("localizacao") || acao === "localizar";
  const [nota, setNota] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [responsavelId, setResponsavelId] = useState("");

  useEffect(() => {
    if (!acao) return;
    setNota("");
    setLocalizacao(pedido?.localizacaoFisica || "");
    // P3: no arquivamento, sugere quem fez a busca.
    const sugerido = acao === "atribuir_arquivamento" ? pedido?.arquivamentoResponsavelId : pedido?.buscaResponsavelId;
    setResponsavelId(sugerido ? String(sugerido) : "");
  }, [acao, pedido]);

  const responsaveis = useQuery({
    queryKey: ["/api/users/responsaveis-busca"],
    enabled: !!pedeResponsavel,
    staleTime: 60_000
  });

  const enviar = useMutation({
    mutationFn: () =>
      api("POST", `/api/requests/${pedido.id}/acoes`, {
        acao,
        nota: nota || null,
        localizacao: pedeLocal ? localizacao || null : null,
        responsavelId: pedeResponsavel && responsavelId ? Number(responsavelId) : null
      }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/relatorios"] });
      toast({ title: "Pedido atualizado", description: `${pedido.protocolId}: ${statusLabel(r.status)}` });
      onClose();
    }
  });

  if (!def) return null;
  const faltando =
    (exige("nota") && !nota.trim()) || (pedeResponsavel && !responsavelId) || (exige("localizacao") && !localizacao.trim());

  return (
    <Dialog open={!!acao} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{def.label}</DialogTitle>
          <DialogDescription>
            Pedido {pedido.protocolId}: {statusLabel(pedido.status)} → <strong>{statusLabel(def.para)}</strong>
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!faltando) enviar.mutate();
          }}
        >
          {pedeResponsavel && (
            <div className="space-y-1">
              <Label htmlFor="acao-resp">Responsável</Label>
              <select
                id="acao-resp"
                required
                value={responsavelId}
                onChange={(e) => setResponsavelId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Selecione…</option>
                {(responsaveis.data || []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {roleLabel(u.role)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {pedeLocal && (
            <div className="space-y-1">
              <Label htmlFor="acao-local">
                Localização física {exige("localizacao") ? "(obrigatória)" : "(opcional)"}
              </Label>
              <Input
                id="acao-local"
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                placeholder="Ex.: Galpão 2, estante 14, caixa 305"
                maxLength={200}
                required={exige("localizacao")}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="acao-nota">{exige("nota") ? "Motivo (obrigatório)" : "Observação (opcional)"}</Label>
            <Textarea
              id="acao-nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={1000}
              rows={3}
              required={exige("nota")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant={def.perigo ? "destructive" : "default"} disabled={faltando || enviar.isPending}>
              {enviar.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
