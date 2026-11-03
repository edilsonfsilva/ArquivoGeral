// ==================================================================
// Fluxo de desarquivamento — fonte única de regras (servidor e cliente).
// Atendimento → Busca → Atendimento → parte → Atendimento → Busca (rearquivamento).
// ==================================================================

// ---------------- Perfis ----------------
export const ROLES = {
  gerente_arquivo: { label: "Gerente do Arquivo", setor: "gerencia", nivel: "gerente" },
  chefe_atendimento: { label: "Chefe de Unidade — Atendimento", setor: "atendimento", nivel: "chefe" },
  servidor_atendimento: { label: "Servidor — Atendimento", setor: "atendimento", nivel: "servidor" },
  operador_atendimento: { label: "Operador de Atendimento", setor: "atendimento", nivel: "operador" },
  chefe_busca: { label: "Chefe de Unidade — Busca", setor: "busca", nivel: "chefe" },
  servidor_busca: { label: "Servidor — Busca", setor: "busca", nivel: "servidor" },
  operador_busca: { label: "Operador de Busca e Desarquivamento", setor: "busca", nivel: "operador" }
};
export const ROLE_KEYS = Object.keys(ROLES);

export const SETORES = {
  atendimento: { label: "Atendimento", tela: "/atendimento" },
  busca: { label: "Busca e Desarquivamento", tela: "/busca" },
  gerencia: { label: "Gerência do Arquivo", tela: "/gerencia" }
};

export const setorDoPerfil = (role) => ROLES[role]?.setor ?? null;
export const telaInicial = (role) => SETORES[setorDoPerfil(role)]?.tela ?? "/admin";

const ATEND = ["chefe_atendimento", "servidor_atendimento", "operador_atendimento"];
const BUSCA_GESTAO = ["chefe_busca", "servidor_busca"];
const BUSCA = [...BUSCA_GESTAO, "operador_busca"];

// ---------------- Status ----------------
// label: visão interna · publico: texto da consulta pública · setor: com quem está a "bola".
export const STATUS = {
  solicitado: { label: "Aguardando triagem", publico: "Recebido — em análise pelo Atendimento", setor: "atendimento" },
  indeferido: { label: "Indeferido", publico: "Indeferido", setor: null, final: true },
  aguardando_busca: { label: "Aguardando atribuição na Busca", publico: "Em busca no Arquivo Geral", setor: "busca" },
  em_busca: { label: "Em busca", publico: "Em busca no Arquivo Geral", setor: "busca" },
  localizado: { label: "Localizado — enviado ao Atendimento", publico: "Processo localizado", setor: "atendimento" },
  disponivel: { label: "Disponível no Atendimento", publico: "Disponível para consulta no Atendimento", setor: "atendimento" },
  em_consulta: { label: "Com a parte / advogado", publico: "Em consulta pela parte", setor: "atendimento" },
  aguardando_arquivamento: {
    label: "Devolvido — aguardando atribuição p/ arquivar",
    publico: "Devolvido — em rearquivamento",
    setor: "busca"
  },
  em_arquivamento: { label: "Em arquivamento", publico: "Devolvido — em rearquivamento", setor: "busca" },
  nao_localizado: { label: "Não localizado — avisar a parte", publico: "Processo não localizado", setor: "atendimento" },
  encerrado: { label: "Encerrado (não localizado)", publico: "Encerrado — processo não localizado", setor: null, final: true },
  arquivado: { label: "Arquivado — ciclo concluído", publico: "Concluído — processo rearquivado", setor: null, final: true }
};
export const STATUS_KEYS = Object.keys(STATUS);

// ---------------- Ações (transições) ----------------
// exige: dados obrigatórios · responsavel: campo do pedido que restringe o operador da Busca.
export const ACOES = {
  // segredo: em processo sob segredo de justiça, exige confirmar habilitação/procuração (Q9).
  encaminhar_busca: { label: "Encaminhar para a Busca", de: ["solicitado"], para: "aguardando_busca", perfis: ATEND, exige: [], segredo: true },
  indeferir: { label: "Indeferir", de: ["solicitado"], para: "indeferido", perfis: ATEND, exige: ["nota"], perigo: true },
  atribuir_busca: {
    label: "Atribuir responsável pela busca",
    de: ["aguardando_busca", "em_busca"],
    para: "em_busca",
    perfis: BUSCA_GESTAO,
    exige: ["responsavelId"]
  },
  localizar: {
    label: "Localizado — enviar ao Atendimento",
    de: ["em_busca"],
    para: "localizado",
    perfis: BUSCA,
    exige: [],
    responsavel: "buscaResponsavelId"
  },
  nao_localizar: {
    label: "Não localizado",
    de: ["em_busca"],
    para: "nao_localizado",
    perfis: BUSCA,
    exige: ["nota"],
    responsavel: "buscaResponsavelId",
    perigo: true
  },
  receber: { label: "Confirmar recebimento do processo", de: ["localizado"], para: "disponivel", perfis: ATEND, exige: [] },
  entregar_parte: { label: "Entregar à parte / advogado", de: ["disponivel"], para: "em_consulta", perfis: ATEND, exige: [], segredo: true },
  registrar_devolucao: {
    label: "Devolvido — enviar para arquivamento",
    de: ["em_consulta", "disponivel"],
    para: "aguardando_arquivamento",
    perfis: ATEND,
    exige: []
  },
  encerrar: { label: "Parte avisada — encerrar", de: ["nao_localizado"], para: "encerrado", perfis: ATEND, exige: [] },
  // Processo não localizado pode ser procurado de novo, sem limite de tentativas, enquanto não for encerrado.
  // Quem pede: a própria Busca ou o Atendimento (a pedido da parte). Volta para "em busca" com o mesmo
  // responsável; chefe/servidor da Busca podem reatribuir depois.
  nova_busca: {
    label: "Nova busca",
    de: ["nao_localizado"],
    para: "em_busca",
    perfis: [...BUSCA, ...ATEND],
    exige: [],
    responsavel: "buscaResponsavelId"
  },
  atribuir_arquivamento: {
    label: "Atribuir responsável pelo arquivamento",
    de: ["aguardando_arquivamento", "em_arquivamento"],
    para: "em_arquivamento",
    perfis: BUSCA_GESTAO,
    exige: ["responsavelId"]
  },
  arquivar: {
    label: "Arquivado",
    de: ["em_arquivamento"],
    para: "arquivado",
    perfis: BUSCA,
    exige: ["localizacao"],
    responsavel: "arquivamentoResponsavelId"
  }
};
export const ACAO_KEYS = Object.keys(ACOES);

const MSG_EXIGE = {
  nota: "Informe o motivo",
  responsavelId: "Selecione o responsável",
  localizacao: "Informe a localização física (estante/caixa)"
};
export const MSG_SEGREDO =
  "Processo em segredo de justiça: confirme que o solicitante é advogado habilitado nos autos ou tem procuração das partes";

/** Devolve null se a ação é permitida, ou a mensagem do impedimento. */
export function verificarAcao(role, acaoKey, pedido, userId, dados = {}) {
  const acao = ACOES[acaoKey];
  if (!acao) return "Ação desconhecida";
  if (!ROLES[role] || !acao.perfis.includes(role)) return "Seu perfil não pode executar esta ação";
  if (!pedido || !acao.de.includes(pedido.status)) return "Esta ação não é possível nesta etapa do pedido";
  if (acao.responsavel && role === "operador_busca" && pedido[acao.responsavel] !== userId) {
    return "Este pedido está atribuído a outro responsável";
  }
  for (const campo of acao.exige) {
    const v = dados?.[campo];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return MSG_EXIGE[campo];
  }
  if (acao.segredo && pedido.segredoJustica === "sim" && dados?.confirmaHabilitacao !== true) return MSG_SEGREDO;
  return null;
}

/** Permissão sem checar dados exigidos quando `dados` é omitido? Não: checa tudo. */
export const podeExecutar = (role, acaoKey, pedido, userId, dados) =>
  verificarAcao(role, acaoKey, pedido, userId, dados ?? preencherExigidos(acaoKey)) === null;

// Para a interface: considera os dados exigidos como "a preencher no diálogo".
function preencherExigidos(acaoKey) {
  const out = { confirmaHabilitacao: true };
  for (const c of ACOES[acaoKey]?.exige || []) out[c] = "x";
  return out;
}

export const acoesDisponiveis = (role, pedido, userId) =>
  ACAO_KEYS.filter((k) => verificarAcao(role, k, pedido, userId, preencherExigidos(k)) === null);

// ---------------- Usuários ----------------
const CRIAVEIS = {
  gerente_arquivo: ["gerente_arquivo", "chefe_atendimento", "chefe_busca"],
  chefe_atendimento: ["servidor_atendimento", "operador_atendimento"],
  chefe_busca: ["servidor_busca", "operador_busca"]
};
export const perfisCriaveis = (role) => [...(CRIAVEIS[role] || [])];

/** Pode criar/editar/desativar um usuário com o perfil `alvo`? O Gerente desativa qualquer um. */
export const podeGerenciarUsuario = (ator, alvo) =>
  ator === "gerente_arquivo" ? !!ROLES[alvo] : perfisCriaveis(ator).includes(alvo);

export const gerenciaUsuarios = (role) => perfisCriaveis(role).length > 0;

// ---------------- Visibilidade ----------------
export const veDadosPessoais = (role) => role === "gerente_arquivo" || ATEND.includes(role);
export const podeSerResponsavelBusca = (role) => BUSCA.includes(role);

// ---------------- Certidões ----------------
export const CERTIDAO_TIPOS = {
  desarquivamento: {
    label: "Certidão de Desarquivamento",
    status: ["disponivel", "em_consulta", "aguardando_arquivamento", "em_arquivamento", "arquivado"],
    texto:
      "CERTIFICO, para os devidos fins, que o processo abaixo identificado foi localizado no Arquivo Geral e DESARQUIVADO, " +
      "encontrando-se à disposição da parte interessada no setor de Atendimento a partir da data indicada."
  },
  nao_localizacao: {
    label: "Certidão de Não Localização",
    status: ["nao_localizado", "encerrado"],
    texto:
      "CERTIFICO, para os devidos fins, que, realizadas as buscas no acervo do Arquivo Geral, o processo abaixo " +
      "identificado NÃO FOI LOCALIZADO até a presente data."
  },
  arquivamento: {
    label: "Certidão de Arquivamento",
    status: ["arquivado"],
    texto:
      "CERTIFICO, para os devidos fins, que o processo abaixo identificado foi devolvido pela parte e REARQUIVADO " +
      "no Arquivo Geral, na localização física indicada."
  }
};
export const CERTIDAO_KEYS = Object.keys(CERTIDAO_TIPOS);
// ---------------- Modelos de certidão (personalizáveis) ----------------
export const podeEditarModelos = (role) => role === "chefe_atendimento" || role === "gerente_arquivo";
// Campos automáticos aceitos no texto do modelo: {campo} → valor do pedido.
export const CAMPOS_MODELO = {
  processo: { label: "Número do processo", de: (d) => d.numeroProcesso },
  partes: { label: "Partes", de: (d) => d.partes },
  comarca: { label: "Comarca", de: (d) => d.comarca },
  vara: { label: "Vara / unidade", de: (d) => d.varaUnidade },
  requerente: { label: "Nome do requerente", de: (d) => d.requerente ?? d.nomeCompleto },
  protocolo: { label: "Protocolo", de: (d) => d.protocolo ?? d.protocolId },
  localizacao: { label: "Localização física", de: (d) => d.localizacaoFisica },
  motivo: { label: "Motivo da não localização", de: (d) => d.motivo }
};
export function renderModelo(texto, dados) {
  return String(texto || "").replace(/\{(\w+)\}/g, (m, campo) => {
    const def = CAMPOS_MODELO[campo];
    const v = def ? def.de(dados || {}) : undefined;
    return v == null || v === "" ? (def ? "—" : m) : String(v);
  });
}

// ---------------- Prazo de devolução (Q7) ----------------
// Prazo para o processo voltar ao arquivo depois de ficar disponível no Atendimento.
export const PRAZO_DEVOLUCAO_HORAS_PADRAO = 24;
export const STATUS_FORA_DO_ARQUIVO = ["disponivel", "em_consulta"];
export function prazoVencido(pedido, horas = PRAZO_DEVOLUCAO_HORAS_PADRAO, agora = new Date()) {
  if (!pedido?.disponivelEm || !STATUS_FORA_DO_ARQUIVO.includes(pedido.status)) return false;
  return agora.getTime() - new Date(pedido.disponivelEm).getTime() > horas * 3600_000;
}
export const veAlertasPrazo = (role) => role === "servidor_atendimento" || role === "chefe_atendimento";

export const podeEmitirCertidao = (role) => role === "servidor_atendimento" || role === "chefe_atendimento";
export const certidoesDisponiveis = (status) => CERTIDAO_KEYS.filter((k) => CERTIDAO_TIPOS[k].status.includes(status));
