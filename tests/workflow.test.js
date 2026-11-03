// Testes da máquina de estados e das permissões (ECC tdd-workflow: escritos antes da implementação).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  STATUS,
  ROLES,
  ACOES,
  CERTIDAO_TIPOS,
  verificarAcao,
  podeExecutar,
  acoesDisponiveis,
  perfisCriaveis,
  podeGerenciarUsuario,
  veDadosPessoais,
  podeEmitirCertidao,
  certidoesDisponiveis,
  podeSerResponsavelBusca,
  setorDoPerfil,
  telaInicial
} from "../shared/workflow.js";

const ATEND = ["chefe_atendimento", "servidor_atendimento", "operador_atendimento"];
const BUSCA = ["chefe_busca", "servidor_busca", "operador_busca"];
const TODOS = ["gerente_arquivo", ...ATEND, ...BUSCA];

// Transições esperadas: [ação, status de origem, status de destino]
const ESPERADAS = [
  ["encaminhar_busca", "solicitado", "aguardando_busca"],
  ["indeferir", "solicitado", "indeferido"],
  ["atribuir_busca", "aguardando_busca", "em_busca"],
  ["atribuir_busca", "em_busca", "em_busca"],
  ["localizar", "em_busca", "localizado"],
  ["nao_localizar", "em_busca", "nao_localizado"],
  ["receber", "localizado", "disponivel"],
  ["entregar_parte", "disponivel", "em_consulta"],
  ["registrar_devolucao", "em_consulta", "aguardando_arquivamento"],
  ["registrar_devolucao", "disponivel", "aguardando_arquivamento"],
  ["encerrar", "nao_localizado", "encerrado"],
  ["nova_busca", "nao_localizado", "em_busca"],
  ["atribuir_arquivamento", "aguardando_arquivamento", "em_arquivamento"],
  ["atribuir_arquivamento", "em_arquivamento", "em_arquivamento"],
  ["arquivar", "em_arquivamento", "arquivado"]
];

// Quem pode executar cada ação (desconsiderando a regra de "responsável").
const PERFIS_ESPERADOS = {
  encaminhar_busca: ATEND,
  indeferir: ATEND,
  receber: ATEND,
  entregar_parte: ATEND,
  registrar_devolucao: ATEND,
  encerrar: ATEND,
  atribuir_busca: ["chefe_busca", "servidor_busca"],
  atribuir_arquivamento: ["chefe_busca", "servidor_busca"],
  localizar: BUSCA,
  nao_localizar: BUSCA,
  arquivar: BUSCA,
  nova_busca: [...BUSCA, ...ATEND]
};

// Dados mínimos exigidos por ação, para os testes passarem a validação.
const DADOS = {
  indeferir: { nota: "Procuração ausente" },
  nao_localizar: { nota: "Caixa vazia" },
  atribuir_busca: { responsavelId: 7 },
  atribuir_arquivamento: { responsavelId: 7 },
  arquivar: { localizacao: "Estante 3, caixa 12" }
};

const pedidoEm = (status, extra = {}) => ({
  status,
  buscaResponsavelId: 7,
  arquivamentoResponsavelId: 7,
  ...extra
});

describe("catálogo", () => {
  test("todo status tem rótulo interno e público", () => {
    for (const [k, s] of Object.entries(STATUS)) {
      assert.ok(s.label, `label de ${k}`);
      assert.ok(s.publico, `publico de ${k}`);
    }
  });
  test("são 7 perfis em 3 setores", () => {
    assert.equal(Object.keys(ROLES).length, 7);
    assert.deepEqual(new Set(Object.values(ROLES).map((r) => r.setor)), new Set(["gerencia", "atendimento", "busca"]));
    assert.equal(setorDoPerfil("operador_busca"), "busca");
    assert.equal(setorDoPerfil("inexistente"), null);
  });
  test("toda ação aponta para status existentes", () => {
    for (const [k, a] of Object.entries(ACOES)) {
      assert.ok(STATUS[a.para], `destino de ${k}`);
      for (const de of a.de) assert.ok(STATUS[de], `origem ${de} de ${k}`);
    }
  });
  test("status finais não têm saída", () => {
    const finais = Object.entries(STATUS).filter(([, s]) => s.final).map(([k]) => k);
    assert.deepEqual(finais.sort(), ["arquivado", "encerrado", "indeferido"]);
    for (const a of Object.values(ACOES)) for (const f of finais) assert.ok(!a.de.includes(f));
  });
  test("tela inicial por setor", () => {
    assert.equal(telaInicial("operador_atendimento"), "/atendimento");
    assert.equal(telaInicial("chefe_busca"), "/busca");
    assert.equal(telaInicial("gerente_arquivo"), "/gerencia");
  });
});

describe("matriz completa perfil × ação × status", () => {
  for (const role of TODOS) {
    for (const acao of Object.keys(ACOES)) {
      for (const status of Object.keys(STATUS)) {
        const esperada = ESPERADAS.some(([a, de]) => a === acao && de === status) && PERFIS_ESPERADOS[acao].includes(role);
        test(`${role} · ${acao} · ${status} → ${esperada ? "permite" : "nega"}`, () => {
          // userId 7 = responsável pelo pedido, então a regra de "só os seus" não interfere aqui.
          const r = podeExecutar(role, acao, pedidoEm(status), 7, DADOS[acao] || {});
          assert.equal(r, esperada);
        });
      }
    }
  }
});

describe("destino das transições", () => {
  for (const [acao, de, para] of ESPERADAS) {
    test(`${acao}: ${de} → ${para}`, () => assert.equal(ACOES[acao].para, para));
  }
});

describe("regra do responsável (operador da Busca)", () => {
  test("operador não age em pedido atribuído a outro", () => {
    assert.equal(podeExecutar("operador_busca", "localizar", pedidoEm("em_busca", { buscaResponsavelId: 99 }), 7), false);
    assert.match(
      verificarAcao("operador_busca", "localizar", pedidoEm("em_busca", { buscaResponsavelId: 99 }), 7),
      /atribuído/
    );
    assert.equal(
      podeExecutar("operador_busca", "arquivar", pedidoEm("em_arquivamento", { arquivamentoResponsavelId: 99 }), 7, DADOS.arquivar),
      false
    );
  });
  test("servidor e chefe da Busca podem agir em pedido de outro", () => {
    for (const role of ["servidor_busca", "chefe_busca"]) {
      assert.equal(podeExecutar(role, "localizar", pedidoEm("em_busca", { buscaResponsavelId: 99 }), 7), true);
    }
  });
});

describe("nova busca de processo não localizado", () => {
  test("Busca pode reabrir a busca; volta para em_busca com o mesmo responsável", () => {
    assert.equal(ACOES.nova_busca.para, "em_busca");
    assert.equal(podeExecutar("chefe_busca", "nova_busca", pedidoEm("nao_localizado", { buscaResponsavelId: 99 }), 1), true);
    assert.equal(podeExecutar("servidor_busca", "nova_busca", pedidoEm("nao_localizado", { buscaResponsavelId: 99 }), 1), true);
  });
  test("sem limite de tentativas: a mesma ação vale a cada não localização", () => {
    const p = pedidoEm("nao_localizado", { tentativas: 50 });
    assert.equal(podeExecutar("servidor_atendimento", "nova_busca", p, 1), true);
    assert.equal(podeExecutar("chefe_busca", "nova_busca", p, 1), true);
  });
  test("operador só reabre a busca que era dele", () => {
    assert.equal(podeExecutar("operador_busca", "nova_busca", pedidoEm("nao_localizado"), 7), true);
    assert.equal(podeExecutar("operador_busca", "nova_busca", pedidoEm("nao_localizado", { buscaResponsavelId: 99 }), 7), false);
  });
  test("depois de encerrado pelo Atendimento não há nova busca", () => {
    for (const r of TODOS) assert.equal(podeExecutar(r, "nova_busca", pedidoEm("encerrado"), 7), false);
  });
  test("Atendimento pode solicitar nova busca ou encerrar; Busca vê nova busca", () => {
    assert.deepEqual(acoesDisponiveis("operador_atendimento", pedidoEm("nao_localizado"), 1).sort(), ["encerrar", "nova_busca"]);
    assert.deepEqual(acoesDisponiveis("servidor_busca", pedidoEm("nao_localizado"), 1), ["nova_busca"]);
  });
});

describe("dados exigidos", () => {
  test("indeferir e não localizar exigem motivo", () => {
    assert.match(verificarAcao("operador_atendimento", "indeferir", pedidoEm("solicitado"), 1, {}), /motivo/i);
    assert.match(verificarAcao("operador_busca", "nao_localizar", pedidoEm("em_busca"), 7, { nota: "  " }), /motivo/i);
  });
  test("atribuir exige responsável", () => {
    assert.match(verificarAcao("chefe_busca", "atribuir_busca", pedidoEm("aguardando_busca"), 1, {}), /responsável/i);
  });
  test("arquivar exige localização física", () => {
    assert.match(verificarAcao("operador_busca", "arquivar", pedidoEm("em_arquivamento"), 7, {}), /localização/i);
  });
  test("ação ou perfil desconhecidos são negados", () => {
    assert.match(verificarAcao("operador_busca", "voar", pedidoEm("em_busca"), 7), /desconhecida/i);
    assert.equal(podeExecutar("admin", "encaminhar_busca", pedidoEm("solicitado"), 1), false);
    assert.equal(podeExecutar(undefined, "encaminhar_busca", pedidoEm("solicitado"), 1), false);
  });
  test("mensagem de etapa errada", () => {
    assert.match(verificarAcao("operador_atendimento", "receber", pedidoEm("solicitado"), 1), /etapa/i);
  });
});

describe("ações disponíveis para a interface", () => {
  test("atendimento vê encaminhar e indeferir na triagem", () => {
    assert.deepEqual(acoesDisponiveis("operador_atendimento", pedidoEm("solicitado"), 1).sort(), ["encaminhar_busca", "indeferir"]);
  });
  test("gerente não opera o fluxo", () => {
    for (const status of Object.keys(STATUS)) {
      assert.deepEqual(acoesDisponiveis("gerente_arquivo", pedidoEm(status), 1), []);
    }
  });
  test("operador da busca só vê ações do pedido que é dele", () => {
    assert.deepEqual(acoesDisponiveis("operador_busca", pedidoEm("em_busca"), 7).sort(), ["localizar", "nao_localizar"]);
    assert.deepEqual(acoesDisponiveis("operador_busca", pedidoEm("em_busca"), 8), []);
  });
});

describe("gestão de usuários", () => {
  test("gerente cria chefes (e outro gerente), não operadores", () => {
    assert.deepEqual(perfisCriaveis("gerente_arquivo").sort(), ["chefe_atendimento", "chefe_busca", "gerente_arquivo"]);
  });
  test("chefe cria só servidores e operadores do próprio setor", () => {
    assert.deepEqual(perfisCriaveis("chefe_atendimento").sort(), ["operador_atendimento", "servidor_atendimento"]);
    assert.deepEqual(perfisCriaveis("chefe_busca").sort(), ["operador_busca", "servidor_busca"]);
  });
  test("servidores e operadores não gerenciam usuários", () => {
    for (const r of ["servidor_atendimento", "operador_atendimento", "servidor_busca", "operador_busca"]) {
      assert.deepEqual(perfisCriaveis(r), []);
    }
  });
  test("chefe não gerencia usuário do outro setor nem outro chefe", () => {
    assert.equal(podeGerenciarUsuario("chefe_atendimento", "operador_busca"), false);
    assert.equal(podeGerenciarUsuario("chefe_atendimento", "chefe_busca"), false);
    assert.equal(podeGerenciarUsuario("chefe_atendimento", "operador_atendimento"), true);
  });
  test("gerente gerencia qualquer perfil (desativar)", () => {
    for (const r of TODOS) assert.equal(podeGerenciarUsuario("gerente_arquivo", r), true);
  });
});

describe("dados pessoais e certidões", () => {
  test("só Atendimento e Gerente veem dados do solicitante", () => {
    for (const r of TODOS) assert.equal(veDadosPessoais(r), r === "gerente_arquivo" || ATEND.includes(r), r);
  });
  test("só servidor e chefe do Atendimento emitem certidão", () => {
    for (const r of TODOS) assert.equal(podeEmitirCertidao(r), ["servidor_atendimento", "chefe_atendimento"].includes(r), r);
  });
  test("tipo de certidão depende da etapa", () => {
    assert.deepEqual(certidoesDisponiveis("solicitado"), []);
    assert.deepEqual(certidoesDisponiveis("disponivel"), ["desarquivamento"]);
    assert.deepEqual(certidoesDisponiveis("nao_localizado"), ["nao_localizacao"]);
    assert.deepEqual(certidoesDisponiveis("encerrado"), ["nao_localizacao"]);
    assert.deepEqual(certidoesDisponiveis("arquivado").sort(), ["arquivamento", "desarquivamento"]);
    for (const t of Object.values(CERTIDAO_TIPOS)) assert.ok(t.label && t.texto);
  });
  test("responsável pela busca precisa ser da Busca", () => {
    assert.equal(podeSerResponsavelBusca("operador_busca"), true);
    assert.equal(podeSerResponsavelBusca("chefe_busca"), true);
    assert.equal(podeSerResponsavelBusca("operador_atendimento"), false);
    assert.equal(podeSerResponsavelBusca("gerente_arquivo"), false);
  });
});

// ---------------- Decisões de 02/11/2026: Q7 (prazo), Q9 (segredo) e modelos de certidão ----------------
import {
  prazoVencido,
  veAlertasPrazo,
  podeEditarModelos,
  renderModelo,
  CAMPOS_MODELO,
  PRAZO_DEVOLUCAO_HORAS_PADRAO
} from "../shared/workflow.js";

describe("Q9 — segredo de justiça", () => {
  const sigiloso = (status) => pedidoEm(status, { segredoJustica: "sim" });
  test("encaminhar e entregar exigem confirmar habilitação/procuração", () => {
    assert.match(verificarAcao("operador_atendimento", "encaminhar_busca", sigiloso("solicitado"), 1, {}), /segredo de justiça/i);
    assert.match(verificarAcao("operador_atendimento", "entregar_parte", sigiloso("disponivel"), 1, {}), /segredo de justiça/i);
    assert.equal(verificarAcao("operador_atendimento", "encaminhar_busca", sigiloso("solicitado"), 1, { confirmaHabilitacao: true }), null);
    assert.equal(verificarAcao("operador_atendimento", "entregar_parte", sigiloso("disponivel"), 1, { confirmaHabilitacao: true }), null);
  });
  test("pedido sem segredo não exige confirmação", () => {
    assert.equal(verificarAcao("operador_atendimento", "encaminhar_busca", pedidoEm("solicitado"), 1, {}), null);
  });
  test("a ação continua aparecendo na interface (confirmação é pedida no diálogo)", () => {
    assert.ok(acoesDisponiveis("operador_atendimento", sigiloso("solicitado"), 1).includes("encaminhar_busca"));
    assert.equal(ACOES.encaminhar_busca.segredo, true);
    assert.equal(ACOES.entregar_parte.segredo, true);
  });
});

describe("Q7 — prazo de devolução", () => {
  const agora = new Date("2026-11-03T15:00:00Z");
  const h = (n) => new Date(agora.getTime() - n * 3600_000).toISOString();
  test("padrão de 24 horas", () => assert.equal(PRAZO_DEVOLUCAO_HORAS_PADRAO, 24));
  test("vence após o prazo enquanto o processo está fora do arquivo", () => {
    assert.equal(prazoVencido({ status: "disponivel", disponivelEm: h(25) }, 24, agora), true);
    assert.equal(prazoVencido({ status: "em_consulta", disponivelEm: h(25) }, 24, agora), true);
    assert.equal(prazoVencido({ status: "em_consulta", disponivelEm: h(23) }, 24, agora), false);
  });
  test("não vence depois de devolvido ou sem data", () => {
    assert.equal(prazoVencido({ status: "aguardando_arquivamento", disponivelEm: h(48) }, 24, agora), false);
    assert.equal(prazoVencido({ status: "disponivel", disponivelEm: null }, 24, agora), false);
  });
  test("alerta vai para servidor e chefe do Atendimento", () => {
    for (const r of TODOS) assert.equal(veAlertasPrazo(r), ["servidor_atendimento", "chefe_atendimento"].includes(r), r);
  });
});

describe("modelos de certidão personalizáveis", () => {
  test("chefe do Atendimento e Gerente editam os modelos", () => {
    for (const r of TODOS) assert.equal(podeEditarModelos(r), ["chefe_atendimento", "gerente_arquivo"].includes(r), r);
  });
  test("campos automáticos são substituídos; desconhecidos ficam como estão", () => {
    const t = renderModelo("Processo {processo} entre {partes}, {comarca}/{vara}. {inexistente}", {
      numeroProcesso: "123",
      partes: "A x B",
      comarca: "Recife",
      varaUnidade: "1ª Vara"
    });
    assert.equal(t, "Processo 123 entre A x B, Recife/1ª Vara. {inexistente}");
  });
  test("lista de campos documentada", () => {
    for (const c of ["processo", "partes", "comarca", "vara", "requerente", "protocolo"]) assert.ok(CAMPOS_MODELO[c], c);
  });
});
