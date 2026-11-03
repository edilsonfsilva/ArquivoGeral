import { Headset } from "lucide-react";
import { useUsuario } from "@/lib/painel";
import { PainelLayout, Carregando } from "@/components/painel/PainelLayout";
import { PainelSetor } from "@/components/painel/PainelSetor";

const ABAS = [
  {
    id: "triagem",
    label: "Triagem",
    statuses: ["solicitado"],
    ajuda: "Pedidos novos: confira os dados e a procuração e encaminhe à Busca ou indefira com motivo.",
    vazio: "Nenhum pedido aguardando triagem."
  },
  {
    id: "receber",
    label: "Chegando da Busca",
    statuses: ["localizado"],
    ajuda: "Processos localizados pela Busca: confirme quando o processo físico chegar ao Atendimento.",
    vazio: "Nenhum processo a caminho."
  },
  {
    id: "balcao",
    label: "No balcão / com a parte",
    statuses: ["disponivel", "em_consulta"],
    ajuda: "Registre a entrega à parte ou ao advogado e, na devolução, envie o processo para rearquivamento."
  },
  {
    id: "nao_localizados",
    label: "Não localizados",
    statuses: ["nao_localizado"],
    ajuda: "A Busca não encontrou o processo. Até o encerramento, a Busca ainda pode fazer uma nova busca; quando decidir encerrar, avise a parte (e emita a certidão, se pedida)."
  },
  {
    id: "na_busca",
    label: "Na Busca",
    statuses: ["aguardando_busca", "em_busca", "aguardando_arquivamento", "em_arquivamento"],
    ajuda: "Acompanhamento: pedidos que estão com o setor de Busca."
  },
  { id: "todos", label: "Todos" }
];

export default function Atendimento() {
  const { data: usuario } = useUsuario("atendimento");
  if (!usuario || usuario.setor !== "atendimento") return <Carregando />;
  return (
    <PainelLayout usuario={usuario} titulo="Atendimento" descricao="Triagem, entrega e devolução de processos desarquivados." icone={Headset}>
      <PainelSetor usuario={usuario} abas={ABAS} />
    </PainelLayout>
  );
}
