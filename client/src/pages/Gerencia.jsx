import { Landmark } from "lucide-react";
import { useUsuario } from "@/lib/painel";
import { PainelLayout, Carregando } from "@/components/painel/PainelLayout";
import { PainelSetor } from "@/components/painel/PainelSetor";

const ABAS = [
  {
    id: "abertos",
    label: "Em aberto",
    filtro: (r) => !["indeferido", "encerrado", "arquivado"].includes(r.status),
    ajuda: "Visão geral de todos os pedidos em andamento, em qualquer setor."
  },
  { id: "finalizados", label: "Finalizados", statuses: ["indeferido", "encerrado", "arquivado"] },
  { id: "todos", label: "Todos" }
];

export default function Gerencia() {
  const { data: usuario } = useUsuario("gerencia");
  if (!usuario || usuario.setor !== "gerencia") return <Carregando />;
  return (
    <PainelLayout usuario={usuario} titulo="Gerência do Arquivo" descricao="Indicadores gerais e cadastro dos chefes de unidade." icone={Landmark}>
      <PainelSetor usuario={usuario} abas={ABAS} abaInicial="painel" modelos />
    </PainelLayout>
  );
}
