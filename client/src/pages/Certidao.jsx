import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDia, fmtData } from "@/lib/painel";

function Linha({ rotulo, valor }) {
  if (!valor) return null;
  return (
    <tr>
      <th scope="row" className="text-left align-top pr-4 py-1 font-semibold whitespace-nowrap">{rotulo}</th>
      <td className="py-1">{valor}</td>
    </tr>
  );
}

/** Certidão pronta para imprimir ou salvar como PDF pelo navegador. */
export default function Certidao() {
  const { id } = useParams();
  const { data: c, isError, isLoading } = useQuery({ queryKey: ["/api/certidoes", id] });
  if (isLoading) return <p className="p-8 text-slate-500" role="status">Carregando certidão…</p>;
  if (isError || !c) return <p className="p-8 text-red-700" role="alert">Certidão não encontrada ou sem permissão.</p>;
  const d = c.dados;
  const urlVerificacao = `${window.location.origin}/verificar/${c.codigo}`;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-8 print:py-0">
      <div className="mx-auto max-w-[800px] mb-4 flex justify-end gap-2 print:hidden px-4">
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir / salvar PDF
        </Button>
      </div>
      <article className="mx-auto max-w-[800px] bg-white shadow print:shadow-none p-12 text-slate-900 font-serif leading-relaxed">
        <header className="text-center space-y-1 border-b pb-4">
          <img src="/logo.png" alt="" className="mx-auto h-16 object-contain" />
          <div className="text-sm font-bold tracking-wide">PODER JUDICIÁRIO</div>
          <div className="text-sm font-bold tracking-wide">TRIBUNAL DE JUSTIÇA DE PERNAMBUCO</div>
          <div className="text-sm">Arquivo Geral</div>
        </header>

        <div className="my-4 rounded border-2 border-amber-500 bg-amber-50 p-2 text-center text-xs font-sans font-semibold text-amber-900">
          PROTÓTIPO PARA VALIDAÇÃO DO FLUXO — DOCUMENTO SEM VALIDADE OFICIAL
        </div>

        <h1 className="text-center text-xl font-bold uppercase mt-6">{d.titulo}</h1>
        <p className="text-center text-sm mb-8">Nº {c.numero}</p>

        <p className="text-justify indent-12">{d.texto}</p>

        <table className="mt-6 text-sm">
          <tbody>
            <Linha rotulo="Processo" valor={`${d.numeroProcesso} (${d.tipoNumeracao === "npu" ? "NPU" : "tombo"})`} />
            <Linha rotulo="Partes" valor={d.partes} />
            <Linha rotulo="Comarca / Unidade" valor={`${d.comarca} — ${d.varaUnidade}`} />
            <Linha rotulo="Requerente" valor={d.requerente} />
            <Linha rotulo="Protocolo" valor={d.protocolo} />
            <Linha rotulo="Solicitado em" valor={fmtDia(d.datas?.solicitacao)} />
            {d.tipo === "desarquivamento" && <Linha rotulo="Localizado em" valor={fmtDia(d.datas?.localizacao)} />}
            {d.tipo === "desarquivamento" && <Linha rotulo="Disponível desde" valor={fmtDia(d.datas?.disponibilizacao)} />}
            {d.tipo === "nao_localizacao" && <Linha rotulo="Buscas concluídas em" valor={fmtDia(d.datas?.naoLocalizacao)} />}
            {d.tipo === "nao_localizacao" && <Linha rotulo="Observação" valor={d.motivo} />}
            {d.tipo === "arquivamento" && <Linha rotulo="Rearquivado em" valor={fmtDia(d.datas?.arquivamento)} />}
            {d.tipo === "arquivamento" && <Linha rotulo="Localização física" valor={d.localizacaoFisica} />}
          </tbody>
        </table>

        <p className="mt-8">
          O referido é verdade e dou fé. Recife, {new Date(c.emitidaEm).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}.
        </p>

        <div className="mt-16 text-center">
          <div className="mx-auto w-72 border-t border-slate-900 pt-1 text-sm">
            {d.servidor?.nome}
            <br />
            Matrícula {d.servidor?.matricula}
          </div>
        </div>

        <footer className="mt-12 border-t pt-3 text-xs font-sans text-slate-600 space-y-0.5">
          <div>Emitida em {fmtData(c.emitidaEm)} · Código de verificação: <strong className="tracking-wider">{c.codigo}</strong></div>
          <div>Confira a autenticidade em {urlVerificacao}</div>
        </footer>
      </article>
    </div>
  );
}
