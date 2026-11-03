import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleLabel, statusLabel } from "@/lib/painel";

function Barras({ titulo, itens, rotulo, valor, vazio = "Sem dados ainda." }) {
  const max = Math.max(1, ...itens.map(valor));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <p className="text-sm text-slate-500">{vazio}</p>
        ) : (
          <ul className="space-y-2">
            {itens.map((it, i) => (
              <li key={i} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-slate-800">{rotulo(it)}</span>
                  <span className="font-medium tabular-nums text-slate-900">{valor(it)}</span>
                </div>
                <div className="h-1.5 rounded bg-slate-100 mt-1" aria-hidden="true">
                  <div className="h-1.5 rounded bg-primary/70" style={{ width: `${(valor(it) / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function Relatorios() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["/api/relatorios"], staleTime: 0, refetchInterval: 60_000 });
  if (isLoading) return <p className="text-sm text-slate-500" role="status">Carregando indicadores…</p>;
  if (isError || !data) return <p className="text-sm text-red-700" role="alert">Não foi possível carregar os indicadores.</p>;
  const t = data.totais;
  const cards = [
    ["Pedidos no total", t.total],
    ["Recebidos hoje", t.hoje],
    ["Ciclos concluídos (arquivados)", t.concluidos],
    ["Não localizados", t.nao_localizados],
    ["Ciclo médio (dias)", t.dias_ciclo ?? "—"]
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {cards.map(([r, v]) => (
          <Card key={r}>
            <CardContent className="p-4">
              <div className="text-2xl font-semibold tabular-nums text-slate-900">{v}</div>
              <div className="text-xs text-slate-600">{r}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Barras titulo="Pedidos por situação" itens={data.porStatus} rotulo={(i) => statusLabel(i.status)} valor={(i) => i.total} />
        <Barras
          titulo="Unidades mais solicitadas"
          itens={data.porUnidade}
          rotulo={(i) => `${i.comarca} · ${i.varaUnidade}`}
          valor={(i) => i.total}
        />
        <Barras
          titulo="Atuação por operador (ações no fluxo)"
          itens={data.porOperador}
          rotulo={(i) => `${i.nome} — ${roleLabel(i.role)} · ${i.pedidos} pedido(s)`}
          valor={(i) => i.acoes}
        />
        {data.solicitantes.length > 0 && (
          <Barras
            titulo="Quem mais solicita"
            itens={data.solicitantes}
            rotulo={(i) => `${i.nome}${i.oab ? ` (OAB ${i.oab})` : ""}`}
            valor={(i) => i.total}
          />
        )}
      </div>
    </div>
  );
}
