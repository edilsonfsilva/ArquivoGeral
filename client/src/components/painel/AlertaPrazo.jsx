import { useQuery } from "@tanstack/react-query";
import { AlarmClock } from "lucide-react";
import { fmtData, statusLabel } from "@/lib/painel";

/** Q7: alerta para servidor e chefe do Atendimento sobre processos fora do arquivo além do prazo. */
export function AlertaPrazo({ onAbrir }) {
  const { data } = useQuery({ queryKey: ["/api/alertas"], staleTime: 0, refetchInterval: 60_000, refetchOnWindowFocus: true });
  if (!data?.itens?.length) return null;
  const n = data.itens.length;
  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950 space-y-2">
      <div className="flex items-center gap-2 font-semibold">
        <AlarmClock className="h-5 w-5" aria-hidden="true" />
        {n === 1 ? "1 processo" : `${n} processos`} fora do arquivo além do prazo de devolução ({data.prazoHoras} h)
      </div>
      <ul className="text-sm space-y-1">
        {data.itens.slice(0, 5).map((i) => (
          <li key={i.id}>
            <button type="button" className="underline underline-offset-2 hover:text-red-700" onClick={() => onAbrir?.(i.id)}>
              {i.protocolId}
            </button>{" "}
            · {i.numeroProcesso} · {statusLabel(i.status)} · disponível desde {fmtData(i.disponivelEm)}
            {i.nomeCompleto ? ` · ${i.nomeCompleto}` : ""}
          </li>
        ))}
      </ul>
      {n > 5 && <p className="text-xs">Veja todos na aba "Prazo vencido".</p>}
    </div>
  );
}
