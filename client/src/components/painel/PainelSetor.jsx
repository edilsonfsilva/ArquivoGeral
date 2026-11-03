import { useDeferredValue, useState } from "react";
import { BarChart3, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePedidos } from "@/lib/painel";
import { gerenciaUsuarios, veDadosPessoais } from "@shared/workflow.js";
import { ListaPedidos } from "./ListaPedidos";
import { Filtros, FILTROS_VAZIOS } from "./Filtros";
import { DetalhePedido } from "./DetalhePedido";
import { Relatorios } from "./Relatorios";
import { GestaoUsuarios } from "./GestaoUsuarios";

/**
 * Tela de um setor: filas em abas (filtradas no cliente a partir da lista do escopo do perfil),
 * filtros de servidor, painel de indicadores e gestão da equipe (para quem pode).
 * abas: [{ id, label, statuses?: string[], filtro?: (pedido, usuario) => bool, vazio?: string }]
 */
export function PainelSetor({ usuario, abas, abaInicial }) {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const filtrosAdiados = useDeferredValue(filtros);
  const [aberto, setAberto] = useState(null);
  const lista = usePedidos(filtrosAdiados);
  const pedidos = lista.data || [];
  const pessoal = veDadosPessoais(usuario.role);

  const daAba = (aba) =>
    pedidos.filter((r) => (!aba.statuses || aba.statuses.includes(r.status)) && (!aba.filtro || aba.filtro(r, usuario)));

  return (
    <>
      <Tabs defaultValue={abaInicial || abas[0].id} className="w-full">
        <TabsList className="bg-white border shadow-sm w-full justify-start h-auto p-1 flex-wrap">
          {abas.map((a) => (
            <TabsTrigger key={a.id} value={a.id} className="py-2 px-3 gap-2 data-[state=active]:bg-primary/5 data-[state=active]:text-primary">
              {a.label}
              <span className="rounded-full bg-slate-100 px-2 text-xs tabular-nums text-slate-700">{daAba(a).length}</span>
            </TabsTrigger>
          ))}
          <TabsTrigger value="painel" className="py-2 px-3 gap-2 data-[state=active]:bg-primary/5 data-[state=active]:text-primary">
            <BarChart3 className="h-4 w-4" aria-hidden="true" /> Indicadores
          </TabsTrigger>
          {gerenciaUsuarios(usuario.role) && (
            <TabsTrigger value="equipe" className="py-2 px-3 gap-2 data-[state=active]:bg-primary/5 data-[state=active]:text-primary">
              <Users className="h-4 w-4" aria-hidden="true" /> {usuario.role === "gerente_arquivo" ? "Usuários" : "Equipe"}
            </TabsTrigger>
          )}
        </TabsList>

        {abas.map((a) => (
          <TabsContent key={a.id} value={a.id} className="space-y-3 mt-4">
            {a.ajuda && <p className="text-sm text-slate-600">{a.ajuda}</p>}
            <Filtros filtros={filtros} onChange={setFiltros} pedidos={daAba(a)} mostrarSolicitante={pessoal} />
            <ListaPedidos
              pedidos={daAba(a)}
              carregando={lista.isLoading}
              erro={lista.isError}
              onRetry={() => lista.refetch()}
              onAbrir={(r) => setAberto(r.id)}
              vazio={a.vazio}
            />
          </TabsContent>
        ))}
        <TabsContent value="painel" className="mt-4">
          <Relatorios />
        </TabsContent>
        {gerenciaUsuarios(usuario.role) && (
          <TabsContent value="equipe" className="mt-4">
            <GestaoUsuarios usuario={usuario} />
          </TabsContent>
        )}
      </Tabs>
      <DetalhePedido pedidoId={aberto} onClose={() => setAberto(null)} />
    </>
  );
}
