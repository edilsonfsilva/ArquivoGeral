// Carrega pedidos FICTÍCIOS em várias etapas do fluxo, para as equipes testarem as telas.
// Uso: node demo-dados.cjs <baseUrl> <contas-demo.json>
const fs = require("fs");
const { cliente, login, cpfFicticio, npuFicticio } = require("./lib.cjs");

const [base, contasFile] = process.argv.slice(2);
const contas = JSON.parse(fs.readFileSync(contasFile, "utf8"));
const call = cliente(base);

// [solicitante, OAB, partes, comarca, vara, etapas a percorrer]
const PEDIDOS = [
  ["Maria José da Silva (fictício)", null, "Maria José da Silva x Banco Exemplo S/A", "Recife", "5ª Vara Cível da Capital", []],
  ["Dr. Paulo Henrique Araújo (fictício)", "PE-12345", "Construtora Modelo Ltda x Município do Exemplo", "Recife", "2ª Vara da Fazenda Pública", []],
  ["Ana Beatriz Cavalcanti (fictício)", "PE-23456", "Espólio de João Cavalcanti", "Olinda", "1ª Vara de Família e Registro Civil", ["encaminhar"]],
  ["José Carlos Ferreira (fictício)", null, "José Carlos Ferreira x Empresa de Telefonia Exemplo", "Jaboatão dos Guararapes", "3ª Vara Cível", ["encaminhar", "atribuir"]],
  ["Dra. Luciana Barros (fictício)", "PE-34567", "Ministério Público x Fulano de Tal", "Recife", "4ª Vara Criminal da Capital", ["encaminhar", "atribuir", "localizar"]],
  ["Dr. Paulo Henrique Araújo (fictício)", "PE-12345", "Associação Exemplo x Estado de Pernambuco", "Recife", "2ª Vara da Fazenda Pública", ["encaminhar", "atribuir", "localizar", "receber"]],
  ["Francisca Oliveira (fictício)", null, "Francisca Oliveira x INSS (exemplo)", "Caruaru", "1ª Vara Cível", ["encaminhar", "atribuir", "localizar", "receber", "entregar"]],
  ["Dra. Luciana Barros (fictício)", "PE-34567", "Condomínio Exemplo x Beltrano", "Paulista", "2ª Vara Cível", ["encaminhar", "atribuir", "naoLocalizar"]],
  ["Roberto Gomes (fictício)", null, "Roberto Gomes x Loja Exemplo", "Recife", "12ª Vara Cível da Capital", ["encaminhar", "atribuir", "localizar", "receber", "entregar", "devolver"]],
  ["Dr. Paulo Henrique Araújo (fictício)", "PE-12345", "Inventário de Maria Exemplo", "Recife", "1ª Vara de Sucessões", ["encaminhar", "atribuir", "localizar", "receber", "entregar", "devolver", "atribuirArq", "arquivar"]],
  ["Sebastião Lima (fictício)", null, "Sebastião Lima x Empresa Exemplo", "Petrolina", "Vara do Trabalho (exemplo)", ["indeferir"]]
];

(async () => {
  const S = {};
  for (const k of Object.keys(contas)) if (contas[k]?.email) S[k] = (await login(call, contas[k].email, contas[k].password)).cookie;
  const ids = {};
  for (const k of ["operador_busca", "operador_busca_2"]) ids[k] = (await call("GET", "/api/auth/me", { cookie: S[k] })).json.id;
  const acao = async (k, id, body) => {
    const r = await call("POST", `/api/requests/${id}/acoes`, { cookie: S[k], body });
    if (r.status !== 200) throw new Error(`${body.acao}: ${r.status} ${r.json?.message}`);
  };

  let n = 0;
  for (const [nome, oab, partes, comarca, vara, etapas] of PEDIDOS) {
    const r = await call("POST", "/api/requests", {
      body: {
        nomeCompleto: nome,
        cpf: cpfFicticio(),
        whatsapp: "(81) 90000-0000",
        email: "exemplo@example.com",
        oab,
        tipoNumeracao: "npu",
        numeroProcesso: npuFicticio(2008 + (n % 12)),
        partes,
        comarca,
        varaUnidade: vara,
        segredoJustica: n % 5 === 4 ? "sim" : "nao",
        observacao: "Pedido fictício para demonstração do protótipo."
      }
    });
    if (r.status !== 201) throw new Error(`criar: ${r.status} ${r.json?.message}`);
    const lista = await call("GET", `/api/requests?q=${r.json.protocolId}`, { cookie: S.operador_atendimento });
    const id = lista.json[0].id;
    const resp = n % 2 ? "operador_busca_2" : "operador_busca";
    for (const e of etapas) {
      if (e === "encaminhar") await acao("operador_atendimento", id, { acao: "encaminhar_busca", confirmaHabilitacao: true });
      if (e === "indeferir") await acao("operador_atendimento", id, { acao: "indeferir", nota: "Requerente não é parte nem procurador constituído (exemplo)." });
      if (e === "atribuir") await acao("servidor_busca", id, { acao: "atribuir_busca", responsavelId: ids[resp] });
      if (e === "localizar") await acao(resp, id, { acao: "localizar", localizacao: `Galpão ${1 + (n % 3)}, estante ${10 + n}, caixa ${200 + n * 7}` });
      if (e === "naoLocalizar") await acao(resp, id, { acao: "nao_localizar", nota: "Caixa indicada no índice não contém o processo (exemplo)." });
      if (e === "receber") await acao("operador_atendimento", id, { acao: "receber" });
      if (e === "entregar") await acao("operador_atendimento", id, { acao: "entregar_parte", confirmaHabilitacao: true });
      if (e === "devolver") await acao("servidor_atendimento", id, { acao: "registrar_devolucao" });
      if (e === "atribuirArq") await acao("chefe_busca", id, { acao: "atribuir_arquivamento", responsavelId: ids[resp] });
      if (e === "arquivar") await acao(resp, id, { acao: "arquivar", localizacao: `Galpão 1, estante ${10 + n}, caixa ${200 + n * 7}` });
    }
    console.log(`${r.json.protocolId}  ${etapas.at(-1) || "solicitado"}`);
    n++;
  }
  console.log(`\n${n} pedidos fictícios carregados.`);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
