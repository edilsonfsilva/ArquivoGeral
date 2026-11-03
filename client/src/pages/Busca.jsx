import { PackageSearch } from "lucide-react";
import { useUsuario } from "@/lib/painel";
import { PainelLayout, Carregando } from "@/components/painel/PainelLayout";
import { PainelSetor } from "@/components/painel/PainelSetor";

const minha = (r, u) =>
  (r.status === "em_busca" && r.buscaResponsavelId === u.id) || (r.status === "em_arquivamento" && r.arquivamentoResponsavelId === u.id);

const ABAS_GESTAO = [
  {
    id: "atribuir",
    label: "A atribuir",
    statuses: ["aguardando_busca", "aguardando_arquivamento"],
    ajuda: "Pedidos vindos do Atendimento (busca) e processos devolvidos (arquivamento): atribua um responsável.",
    vazio: "Nada aguardando atribuição."
  },
  { id: "minhas", label: "Minhas tarefas", filtro: minha, vazio: "Nenhuma tarefa atribuída a você." },
  { id: "andamento", label: "Em andamento", statuses: ["em_busca", "em_arquivamento"], ajuda: "Todas as buscas e arquivamentos em execução." },
  {
    id: "nao_localizados",
    label: "Não localizados",
    statuses: ["nao_localizado"],
    ajuda: "Processos não encontrados. Enquanto o Atendimento não encerrar o pedido, é possível fazer uma nova busca.",
    vazio: "Nenhum processo não localizado em aberto."
  },
  {
    id: "concluidos",
    label: "Concluídos",
    statuses: ["localizado", "disponivel", "em_consulta", "encerrado", "arquivado"],
    ajuda: "Processos já entregues ao Atendimento, encerrados como não localizados ou rearquivados."
  }
];

const ABAS_OPERADOR = [
  {
    id: "minhas",
    label: "Minhas tarefas",
    filtro: minha,
    ajuda: "Localize o processo e envie ao Atendimento (ou informe que não foi localizado); nos devolvidos, registre o arquivamento. Em \"Meu histórico\", um processo não localizado ainda pode receber nova busca.",
    vazio: "Nenhuma tarefa atribuída a você."
  },
  {
    id: "historico",
    label: "Meu histórico",
    filtro: (r, u) => !minha(r, u),
    vazio: "Nenhum pedido concluído por você ainda."
  }
];

export default function Busca() {
  const { data: usuario } = useUsuario("busca");
  if (!usuario || usuario.setor !== "busca") return <Carregando />;
  const operador = usuario.role === "operador_busca";
  return (
    <PainelLayout
      usuario={usuario}
      titulo="Busca e Desarquivamento"
      descricao="Localização, entrega ao Atendimento e rearquivamento de processos."
      icone={PackageSearch}
    >
      <PainelSetor usuario={usuario} abas={operador ? ABAS_OPERADOR : ABAS_GESTAO} />
    </PainelLayout>
  );
}
