import { useMemo } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { csvCell } from "@shared/validation.js";
import { fmtData, statusLabel } from "@/lib/painel";

export const FILTROS_VAZIOS = { q: "", comarca: "", operadorId: "", de: "", ate: "" };

/** Operadores que aparecem nos pedidos carregados (para filtrar por "quem atendeu"). */
function operadoresDe(pedidos) {
  const m = new Map();
  for (const r of pedidos) {
    if (r.atendimentoResponsavelId) m.set(r.atendimentoResponsavelId, r.atendimentoResponsavel);
    if (r.buscaResponsavelId) m.set(r.buscaResponsavelId, r.buscaResponsavel);
    if (r.arquivamentoResponsavelId) m.set(r.arquivamentoResponsavelId, r.arquivamentoResponsavel);
  }
  return [...m.entries()].filter(([, n]) => n).sort((a, b) => a[1].localeCompare(b[1]));
}

export function Filtros({ filtros, onChange, pedidos, todos, mostrarSolicitante }) {
  const operadores = useMemo(() => {
    const lista = operadoresDe(todos || pedidos || []);
    // Mantém visível o operador escolhido mesmo que ele não apareça nos pedidos atuais.
    if (filtros.operadorId && !lista.some(([id]) => String(id) === String(filtros.operadorId))) {
      lista.unshift([filtros.operadorId, "Operador selecionado"]);
    }
    return lista;
  }, [todos, pedidos, filtros.operadorId]);
  const set = (k) => (e) => onChange({ ...filtros, [k]: e.target.value });

  const exportar = () => {
    const cab = ["Protocolo", "Situação", "Registrado em", "Processo", "Partes", "Comarca", "Vara/Unidade"];
    if (mostrarSolicitante) cab.push("Solicitante", "CPF", "OAB", "E-mail", "WhatsApp");
    cab.push("Atendimento", "Busca", "Arquivamento", "Localização física", "Atualizado em");
    const linhas = (pedidos || []).map((r) => {
      const l = [r.protocolId, statusLabel(r.status), fmtData(r.createdAt), r.numeroProcesso, r.partes, r.comarca, r.varaUnidade];
      if (mostrarSolicitante) l.push(r.nomeCompleto, r.cpf, r.oab, r.email, r.whatsapp);
      l.push(r.atendimentoResponsavel, r.buscaResponsavel, r.arquivamentoResponsavel, r.localizacaoFisica, fmtData(r.updatedAt));
      return l.map(csvCell).join(";");
    });
    const csv = "﻿" + [cab.map(csvCell).join(";"), ...linhas].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-3 md:grid-cols-6 items-end bg-white p-4 rounded-xl border">
      <div className="md:col-span-2 space-y-1">
        <Label htmlFor="f-q">{mostrarSolicitante ? "Solicitante, CPF, OAB, protocolo ou processo" : "Protocolo, processo ou partes"}</Label>
        <Input id="f-q" value={filtros.q} onChange={set("q")} placeholder="Buscar…" maxLength={100} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="f-comarca">Comarca / unidade</Label>
        <Input id="f-comarca" value={filtros.comarca} onChange={set("comarca")} placeholder="Ex.: Recife" maxLength={120} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="f-op">Operador responsável</Label>
        <select
          id="f-op"
          value={filtros.operadorId}
          onChange={set("operadorId")}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Todos</option>
          {operadores.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 md:col-span-2">
        <div className="space-y-1">
          <Label htmlFor="f-de">De</Label>
          <Input id="f-de" type="date" value={filtros.de} onChange={set("de")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-ate">Até</Label>
          <Input id="f-ate" type="date" value={filtros.ate} onChange={set("ate")} />
        </div>
      </div>
      <div className="md:col-span-6 flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => onChange(FILTROS_VAZIOS)}>
          Limpar filtros
        </Button>
        <Button variant="secondary" size="sm" onClick={exportar} className="gap-1.5">
          <Download className="h-4 w-4" aria-hidden="true" /> Exportar CSV
        </Button>
      </div>
    </div>
  );
}
