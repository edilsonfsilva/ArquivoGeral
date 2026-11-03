// E2E do fluxo Atendimento ↔ Busca. Uso: node fluxo.cjs <baseUrl> <contas-demo.json>
// Cria pedidos de teste, percorre os caminhos e os exclui no final (rota administrativa do Gerente).
const fs = require("fs");
const { cliente, login, senhaForte, cpfFicticio, npuFicticio } = require("./lib.cjs");

const [base, contasFile] = process.argv.slice(2);
const contas = JSON.parse(fs.readFileSync(contasFile, "utf8"));
const call = cliente(base);
let pass = 0;
let fail = 0;
const ok = (cond, label, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra ? "  -> " + extra : ""}`);
};
const criados = [];

const pedidoBase = (cpf) => ({
  nomeCompleto: "TESTE E2E - apagar",
  cpf,
  whatsapp: "(81) 99999-0000",
  email: "teste.e2e@example.com",
  oab: "PE-00000",
  tipoNumeracao: "npu",
  numeroProcesso: npuFicticio(),
  partes: "Teste E2E x Teste",
  comarca: "Recife",
  varaUnidade: "Vara de Teste E2E",
  segredoJustica: "nao",
  anexo: { name: "procuracao.pdf", type: "application/pdf", base64: Buffer.from("%PDF-1.4\n%%EOF\n").toString("base64") }
});

(async () => {
  const S = {};
  for (const k of Object.keys(contas)) if (contas[k]?.email) S[k] = await login(call, contas[k].email, contas[k].password);
  const ck = (k) => S[k].cookie;
  ok(S.operador_busca.user.tela === "/busca" && S.chefe_atendimento.user.tela === "/atendimento", "Login devolve a tela do setor");

  const acao = (k, id, body) => call("POST", `/api/requests/${id}/acoes`, { cookie: ck(k), body });
  const detalhe = (k, id) => call("GET", `/api/requests/${id}`, { cookie: ck(k) });
  const novoPedido = async () => {
    const cpf = cpfFicticio();
    const r = await call("POST", "/api/requests", { body: pedidoBase(cpf) });
    const lista = await call("GET", `/api/requests?q=${r.json.protocolId}`, { cookie: ck("operador_atendimento") });
    const id = lista.json?.[0]?.id;
    criados.push(id);
    return { id, protocolo: r.json.protocolId, cpf };
  };
  const idOp = S.operador_busca.user.id;
  const idOp2 = S.operador_busca_2.user.id;

  // ================= Ciclo completo =================
  const A = await novoPedido();
  ok(!!A.id, "Pedido público criado e visível ao Atendimento", A.protocolo);
  let d = await detalhe("operador_atendimento", A.id);
  ok(d.json?.status === "solicitado" && d.json.acoes.includes("encaminhar_busca"), "Triagem: status solicitado com ação encaminhar");
  ok(d.json?.timeline?.[0]?.acao === "solicitar", "Linha do tempo registra a solicitação");

  ok((await detalhe("operador_busca", A.id)).status === 404, "Busca não vê pedido ainda em triagem");
  ok((await acao("operador_atendimento", A.id, { acao: "arquivar", localizacao: "x" })).status === 403, "Atendimento não executa ação da Busca");
  ok((await acao("chefe_busca", A.id, { acao: "atribuir_busca", responsavelId: idOp })).status === 404, "Busca não age em pedido fora do seu escopo");
  ok((await acao("operador_atendimento", A.id, { acao: "receber" })).status === 409, "Pular etapa (receber na triagem) = 409");

  let r = await acao("operador_atendimento", A.id, { acao: "encaminhar_busca", segredoJustica: "nao" });
  ok(r.status === 200 && r.json.status === "aguardando_busca", "Atendimento encaminha à Busca", r.json?.message);

  const listaBusca = await call("GET", "/api/requests", { cookie: ck("chefe_busca") });
  const naBusca = listaBusca.json?.find((x) => x.id === A.id);
  ok(!!naBusca, "Chefe da Busca vê o pedido na fila");
  ok(naBusca && !("cpf" in naBusca) && !("email" in naBusca) && !("whatsapp" in naBusca), "Busca não recebe CPF, e-mail nem WhatsApp");
  ok(naBusca && !("observacao" in naBusca) && !("oab" in naBusca), "Busca não recebe a observação livre nem a OAB do solicitante");
  ok((await call("GET", `/api/requests/${A.id}/anexo`, { cookie: ck("chefe_busca") })).status === 403, "Busca não baixa a procuração");

  ok((await acao("operador_busca", A.id, { acao: "atribuir_busca", responsavelId: idOp })).status === 404, "Operador da Busca não vê pedido não atribuído");
  ok((await acao("servidor_busca", A.id, { acao: "atribuir_busca" })).status === 400, "Atribuir sem responsável = 400");
  ok(
    (await acao("servidor_busca", A.id, { acao: "atribuir_busca", responsavelId: S.operador_atendimento.user.id })).status === 400,
    "Responsável precisa ser da Busca"
  );
  const resp = await call("GET", "/api/users/responsaveis-busca", { cookie: ck("servidor_busca") });
  ok(resp.json?.some((u) => u.id === idOp) && !resp.json.some((u) => u.role.includes("atendimento")), "Lista de responsáveis só com a Busca");

  r = await acao("servidor_busca", A.id, { acao: "atribuir_busca", responsavelId: idOp });
  ok(r.status === 200 && r.json.status === "em_busca", "Servidor da Busca atribui ao operador");
  ok((await acao("operador_busca_2", A.id, { acao: "localizar" })).status === 404, "Outro operador não vê/age no pedido");
  const minhas = await call("GET", "/api/requests", { cookie: ck("operador_busca") });
  ok(minhas.json?.some((x) => x.id === A.id), "Pedido aparece em 'minhas buscas' do operador");

  // Concorrência: duas ações ao mesmo tempo → só uma vence.
  const [c1, c2] = await Promise.all([
    acao("operador_busca", A.id, { acao: "localizar", localizacao: "Estante 4, caixa 18" }),
    acao("chefe_busca", A.id, { acao: "localizar" })
  ]);
  ok([c1.status, c2.status].sort().join(",") === "200,409", "Ações simultâneas: uma aplica e a outra recebe 409", `${c1.status},${c2.status}`);

  r = await acao("operador_atendimento", A.id, { acao: "receber" });
  // ---- Q7: prazo de devolução e alertas
  const alertasOp = await call("GET", "/api/alertas", { cookie: ck("operador_atendimento") });
  ok(alertasOp.status === 403, "Alerta de prazo não vai para o operador (só servidor e chefe)");
  let det7 = await detalhe("servidor_atendimento", A.id);
  ok(!!det7.json?.disponivelEm && typeof det7.json?.prazoVencido === "boolean", "Pedido disponível registra o início do prazo");
  if (det7.json?.prazoHoras < 0.01) {
    // Ambiente de teste com prazo curto (PRAZO_DEVOLUCAO_HORAS): espera vencer.
    await new Promise((res) => setTimeout(res, det7.json.prazoHoras * 3600_000 + 1500));
    det7 = await detalhe("servidor_atendimento", A.id);
    ok(det7.json?.prazoVencido === true, "Prazo vence depois do limite");
    const al = await call("GET", "/api/alertas", { cookie: ck("chefe_atendimento") });
    ok(al.json?.itens?.some((i) => i.id === A.id), "Chefe do Atendimento recebe o alerta do processo atrasado");
    const al2 = await call("GET", "/api/alertas", { cookie: ck("servidor_atendimento") });
    ok(al2.json?.itens?.some((i) => i.id === A.id), "Servidor do Atendimento recebe o alerta do processo atrasado");
  } else {
    ok(det7.json?.prazoHoras === 24 && det7.json?.prazoVencido === false, "Prazo de 24 h configurado e ainda dentro do prazo");
    ok((await call("GET", "/api/alertas", { cookie: ck("servidor_atendimento") })).status === 200, "Servidor do Atendimento consulta alertas");
  }
  ok(r.status === 200 && r.json.status === "disponivel", "Atendimento confirma recebimento");

  ok((await call("POST", `/api/requests/${A.id}/certidoes`, { cookie: ck("operador_atendimento"), body: { tipo: "desarquivamento" } })).status === 403, "Operador do Atendimento não emite certidão");
  ok((await call("POST", `/api/requests/${A.id}/certidoes`, { cookie: ck("servidor_atendimento"), body: { tipo: "arquivamento" } })).status === 409, "Certidão de arquivamento antes de arquivar = 409");
  // ---- Modelos de certidão personalizáveis
  ok((await call("GET", "/api/certidoes/modelos", { cookie: ck("servidor_atendimento") })).json?.modelos?.length === 3, "Servidor consulta os modelos");
  ok(
    (await call("PUT", "/api/certidoes/modelos/desarquivamento", { cookie: ck("servidor_atendimento"), body: { titulo: "X título", texto: "Texto qualquer suficiente." } })).status === 403,
    "Servidor não edita modelo"
  );
  ok(
    (await call("PUT", "/api/certidoes/modelos/desarquivamento", { cookie: ck("operador_busca"), body: { titulo: "X título", texto: "Texto qualquer suficiente." } })).status === 403,
    "Busca não edita modelo"
  );
  const pers = await call("PUT", "/api/certidoes/modelos/desarquivamento", {
    cookie: ck("chefe_atendimento"),
    body: { titulo: "Certidão de Desarquivamento (E2E)", texto: "CERTIFICO que o processo {processo}, de {partes}, foi desarquivado (teste E2E)." }
  });
  ok(pers.status === 200, "Chefe do Atendimento personaliza o modelo");
  const cert1 = await call("POST", `/api/requests/${A.id}/certidoes`, { cookie: ck("servidor_atendimento"), body: { tipo: "desarquivamento" } });
  ok(cert1.status === 201 && /^CERT-\d{4}-\d{6}$/.test(cert1.json?.numero || ""), "Servidor emite certidão de desarquivamento", cert1.json?.message);
  const certDoc = await call("GET", `/api/certidoes/${cert1.json?.id}`, { cookie: ck("servidor_atendimento") });
  ok(certDoc.json?.dados?.servidor?.matricula === contas.servidor_atendimento.matricula, "Certidão traz nome e matrícula do servidor");
  ok(!!certDoc.json?.dados?.datas?.localizacao, "Certidão registra a data de localização");
  ok(
    certDoc.json?.dados?.titulo === "Certidão de Desarquivamento (E2E)" && certDoc.json?.dados?.texto?.includes(certDoc.json?.dados?.numeroProcesso),
    "Certidão usa o modelo personalizado com os campos preenchidos"
  );
  ok((await call("DELETE", "/api/certidoes/modelos/desarquivamento", { cookie: ck("gerente_arquivo") })).status === 200, "Gerente restaura o modelo padrão");
  const mods = await call("GET", "/api/certidoes/modelos", { cookie: ck("servidor_atendimento") });
  ok(mods.json?.modelos?.find((m) => m.tipo === "desarquivamento")?.personalizado === false, "Modelo volta ao padrão");
  const certAntiga = await call("GET", `/api/certidoes/${cert1.json?.id}`, { cookie: ck("servidor_atendimento") });
  ok(certAntiga.json?.dados?.titulo === "Certidão de Desarquivamento (E2E)", "Certidão já emitida não muda com o modelo");
  const ver = await call("GET", `/api/certidoes/verificar/${cert1.json?.codigo}`);
  ok(ver.status === 200 && ver.json?.numero === cert1.json?.numero && !("requerente" in ver.json), "Verificação pública confere a certidão (sem dados pessoais)");
  ok((await call("GET", "/api/certidoes/verificar/AAAAAAAAAAAA")).status === 404, "Código inexistente = 404");

  r = await acao("operador_atendimento", A.id, { acao: "entregar_parte" });
  ok(r.status === 200 && r.json.status === "em_consulta", "Entregue à parte");
  r = await acao("operador_atendimento", A.id, { acao: "registrar_devolucao" });
  const alDepois = await call("GET", "/api/alertas", { cookie: ck("chefe_atendimento") });
  ok(!alDepois.json?.itens?.some((i) => i.id === A.id), "Depois da devolução, o alerta some");
  ok(r.status === 200 && r.json.status === "aguardando_arquivamento", "Devolução → aguardando arquivamento");
  d = await detalhe("chefe_busca", A.id);
  ok(d.json?.arquivamentoResponsavelId === idOp, "Rearquivamento sugere o responsável da busca (P3)");
  r = await acao("chefe_busca", A.id, { acao: "atribuir_arquivamento", responsavelId: idOp });
  ok(r.status === 200 && r.json.status === "em_arquivamento", "Chefe da Busca atribui o arquivamento");
  ok((await acao("operador_busca", A.id, { acao: "arquivar" })).status === 400, "Arquivar sem localização = 400");
  r = await acao("operador_busca", A.id, { acao: "arquivar", localizacao: "Estante 4, caixa 18" });
  ok(r.status === 200 && r.json.status === "arquivado", "Operador arquiva: ciclo concluído");
  ok((await acao("operador_busca", A.id, { acao: "arquivar", localizacao: "x" })).status === 409, "Pedido arquivado não aceita nova ação");
  const cert2 = await call("POST", `/api/requests/${A.id}/certidoes`, { cookie: ck("chefe_atendimento"), body: { tipo: "arquivamento" } });
  ok(cert2.status === 201, "Chefe do Atendimento emite certidão de arquivamento");
  d = await detalhe("gerente_arquivo", A.id);
  const seq = d.json?.timeline?.map((e) => e.acao).join(">");
  ok(
    seq === "solicitar>encaminhar_busca>atribuir_busca>localizar>receber>emitir_certidao>entregar_parte>registrar_devolucao>atribuir_arquivamento>arquivar>emitir_certidao",
    "Trilha de auditoria completa e na ordem",
    seq
  );
  ok(d.json?.acoes?.length === 0 && d.json?.atendimentoResponsavel === contas.operador_atendimento.name, "Gerente vê tudo, sem ações; operador responsável registrado");

  // Consulta pública
  const cons = await call("POST", "/api/consulta", { body: { protocolo: A.protocolo.toLowerCase(), cpf: A.cpf } });
  ok(cons.status === 200 && cons.json?.final === true && cons.json?.historico?.length >= 4, "Consulta pública mostra andamento", cons.json?.message);
  ok(!JSON.stringify(cons.json).includes(contas.operador_busca.name), "Consulta pública não revela nomes de servidores");
  ok((await call("POST", "/api/consulta", { body: { protocolo: A.protocolo, cpf: cpfFicticio() } })).status === 404, "Consulta com CPF de outra pessoa = 404");

  // ================= Não localizado =================
  const B = await novoPedido();
  await acao("operador_atendimento", B.id, { acao: "encaminhar_busca", segredoJustica: "nao" });
  await acao("chefe_busca", B.id, { acao: "atribuir_busca", responsavelId: idOp2 });
  ok((await acao("operador_busca_2", B.id, { acao: "nao_localizar" })).status === 400, "Não localizado sem motivo = 400");
  r = await acao("operador_busca_2", B.id, { acao: "nao_localizar", nota: "Caixa indicada no índice está vazia" });
  ok(r.status === 200 && r.json.status === "nao_localizado", "Busca informa não localizado");
  // Nova busca (pedido do usuário): a Busca reabre a procura antes do encerramento.
  ok([403, 404].includes((await acao("operador_busca", B.id, { acao: "nova_busca" })).status), "Outro operador não reabre a busca alheia");
  r = await acao("chefe_busca", B.id, { acao: "nova_busca", nota: "Verificar também o galpão 3" });
  ok(r.status === 200 && r.json.status === "em_busca", "Busca faz nova busca do processo não localizado");
  d = await detalhe("chefe_busca", B.id);
  ok(d.json?.buscaResponsavelId === idOp2 && d.json?.motivo === null, "Nova busca mantém o responsável e limpa o motivo anterior");
  r = await acao("operador_busca_2", B.id, { acao: "nao_localizar", nota: "Também não encontrado no galpão 3" });
  ok(r.status === 200 && r.json.status === "nao_localizado", "Segunda tentativa registrada como não localizado");
  r = await acao("operador_atendimento", B.id, { acao: "nova_busca", nota: "Parte trouxe o número antigo do processo" });
  ok(r.status === 200 && r.json.status === "em_busca", "Atendimento solicita nova busca (terceira tentativa)");
  r = await acao("operador_busca_2", B.id, { acao: "nao_localizar", nota: "Não encontrado pelo número antigo" });
  ok(r.status === 200 && r.json.status === "nao_localizado", "Terceira tentativa registrada (sem limite de tentativas)");
  d = await detalhe("operador_atendimento", B.id);
  ok(d.json?.timeline?.filter((e) => e.acao === "nova_busca").length === 2, "Linha do tempo registra cada nova busca");
  const cert3 = await call("POST", `/api/requests/${B.id}/certidoes`, { cookie: ck("servidor_atendimento"), body: { tipo: "nao_localizacao" } });
  ok(cert3.status === 201, "Certidão de não localização");
  r = await acao("operador_atendimento", B.id, { acao: "encerrar" });
  ok(r.status === 200 && r.json.status === "encerrado", "Atendimento avisa a parte e encerra");

  // ================= Q9: segredo de justiça =================
  const sig = { ...pedidoBase(cpfFicticio()), segredoJustica: "sim", oab: null, anexo: null };
  const semLegit = await call("POST", "/api/requests", { body: sig });
  ok(semLegit.status === 400 && /segredo de justiça/i.test(semLegit.json?.message || ""), "Segredo de justiça sem OAB nem procuração = 400");
  const comOab = await call("POST", "/api/requests", { body: { ...sig, oab: "PE-99999" } });
  ok(comOab.status === 201, "Segredo de justiça com OAB é aceito");
  const S9 = (await call("GET", `/api/requests?q=${comOab.json?.protocolId}`, { cookie: ck("operador_atendimento") })).json?.[0];
  criados.push(S9?.id);
  const s9a = await acao("operador_atendimento", S9?.id, { acao: "encaminhar_busca" });
  ok(s9a.status === 400 && /segredo de justiça/i.test(s9a.json?.message || ""), "Triagem de segredo exige confirmar habilitação/procuração");
  ok(
    (await acao("operador_atendimento", S9?.id, { acao: "encaminhar_busca", segredoJustica: "sim" })).status === 400,
    "Classificado como segredo, ainda exige confirmar habilitação"
  );
  ok(
    (await acao("operador_atendimento", S9?.id, { acao: "encaminhar_busca", segredoJustica: "sim", confirmaHabilitacao: true })).status === 200,
    "Com a classificação e a confirmação, encaminha"
  );
  await acao("servidor_busca", S9?.id, { acao: "atribuir_busca", responsavelId: idOp });
  await acao("operador_busca", S9?.id, { acao: "localizar" });
  await acao("operador_atendimento", S9?.id, { acao: "receber" });
  ok((await acao("operador_atendimento", S9?.id, { acao: "entregar_parte" })).status === 400, "Entrega de processo em segredo exige confirmação");
  ok((await acao("operador_atendimento", S9?.id, { acao: "entregar_parte", confirmaHabilitacao: true })).status === 200, "Com a confirmação, entrega à parte");
  const tl9 = (await detalhe("operador_atendimento", S9?.id)).json?.timeline || [];
  ok(tl9.filter((e) => /habilitação\/procuração conferida/.test(e.nota || "")).length === 2, "Trilha registra as duas conferências de habilitação");

  // Solicitante declarou "não", mas o Atendimento reclassifica como segredo (revisão de segurança).
  const decl = await call("POST", "/api/requests", { body: { ...pedidoBase(cpfFicticio()), segredoJustica: "nao" } });
  const S10 = (await call("GET", `/api/requests?q=${decl.json?.protocolId}`, { cookie: ck("operador_atendimento") })).json?.[0];
  criados.push(S10?.id);
  ok(
    (await acao("operador_atendimento", S10?.id, { acao: "encaminhar_busca", segredoJustica: "sim" })).status === 400,
    "Atendimento reclassifica como segredo: exige confirmar habilitação"
  );
  ok(
    (await acao("operador_atendimento", S10?.id, { acao: "encaminhar_busca", segredoJustica: "sim", confirmaHabilitacao: true })).status === 200,
    "Reclassificado e conferido, encaminha"
  );
  const d10 = (await detalhe("operador_atendimento", S10?.id)).json;
  ok(d10?.segredoJustica === "sim" && d10?.timeline?.some((e) => /reclassificado/.test(e.nota || "")), "Reclassificação gravada no pedido e na trilha");

  // ================= Indeferimento =================
  const C = await novoPedido();
  ok((await acao("operador_atendimento", C.id, { acao: "indeferir" })).status === 400, "Indeferir sem motivo = 400");
  r = await acao("operador_atendimento", C.id, { acao: "indeferir", nota: "Procuração sem poderes específicos" });
  ok(r.status === 200 && r.json.status === "indeferido", "Atendimento indefere com motivo");
  d = await detalhe("operador_atendimento", C.id);
  ok(d.json?.motivo === "Procuração sem poderes específicos", "Motivo do indeferimento gravado");

  // ================= Gerente não opera; filtros =================
  ok((await acao("gerente_arquivo", C.id, { acao: "encaminhar_busca" })).status === 403, "Gerente não executa etapa do fluxo");
  const filtro = await call("GET", `/api/requests?operadorId=${S.operador_atendimento.user.id}&comarca=Recife`, { cookie: ck("chefe_atendimento") });
  ok(filtro.json?.some((x) => x.id === A.id), "Filtro por operador responsável e unidade");
  const hojeRecife = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(new Date());
  const porDia = await call("GET", `/api/requests?de=${hojeRecife}&ate=${hojeRecife}&q=${A.protocolo}`, { cookie: ck("chefe_atendimento") });
  ok(porDia.json?.length === 1, "Filtro de período usa o dia de Recife", hojeRecife);
  const finalizados = (await call("GET", "/api/requests", { cookie: ck("gerente_arquivo") })).json || [];
  ok(finalizados.some((x) => x.id === A.id) && finalizados.some((x) => x.id === C.id), "Listagem traz pedidos em aberto e finalizados");
  const rel = await call("GET", "/api/relatorios", { cookie: ck("gerente_arquivo") });
  ok(rel.json?.porUnidade?.length > 0 && rel.json?.porOperador?.length > 0 && Array.isArray(rel.json?.solicitantes), "Relatórios por unidade, operador e solicitante");
  const relBusca = await call("GET", "/api/relatorios", { cookie: ck("chefe_busca") });
  ok(relBusca.json?.solicitantes?.length === 0, "Relatório da Busca sem dados de solicitantes");
  const relOp = await call("GET", "/api/relatorios", { cookie: ck("operador_busca") });
  ok(relOp.status === 403, "Operador da Busca não acessa indicadores globais");
  const listaBuscaPrazo = (await call("GET", "/api/requests", { cookie: ck("chefe_busca") })).json || [];
  ok(listaBuscaPrazo.every((x) => !("prazoVencido" in x) && !("disponivelEm" in x)), "Busca não recebe o selo nem a data do prazo de devolução");

  // ================= Usuários por setor =================
  const novo = (role) => ({ name: "Teste E2E", email: `e2e.${role}.${Date.now()}@example.com`, matricula: "999", password: senhaForte(), role });
  ok((await call("POST", "/api/users", { cookie: ck("chefe_atendimento"), body: novo("operador_busca") })).status === 403, "Chefe do Atendimento não cria usuário da Busca");
  ok((await call("POST", "/api/users", { cookie: ck("chefe_busca"), body: novo("chefe_busca") })).status === 403, "Chefe não cria outro chefe");
  ok((await call("POST", "/api/users", { cookie: ck("gerente_arquivo"), body: novo("operador_atendimento") })).status === 403, "Gerente cadastra chefes, não operadores");
  ok((await call("GET", "/api/users", { cookie: ck("operador_atendimento") })).status === 403, "Operador não gerencia usuários");
  const listaChefe = await call("GET", "/api/users", { cookie: ck("chefe_busca") });
  ok(listaChefe.json?.every((u) => ["servidor_busca", "operador_busca"].includes(u.role)), "Chefe da Busca só vê a própria equipe");

  const tmp = novo("operador_atendimento");
  const tmpUser = await call("POST", "/api/users", { cookie: ck("chefe_atendimento"), body: tmp });
  ok(tmpUser.status === 201 && tmpUser.json?.setor === "atendimento", "Chefe do Atendimento cadastra operador");
  const tmpLogin = await login(call, tmp.email, tmp.password);
  ok((await call("GET", "/api/requests", { cookie: tmpLogin.cookie })).status === 200, "Novo operador acessa a fila");
  ok(
    (await call("PATCH", `/api/users/${tmpUser.json.id}`, { cookie: ck("gerente_arquivo"), body: { password: senhaForte() } })).status === 403,
    "Gerente não troca a senha de operador (só ativa/desativa)"
  );
  const novaSenha = senhaForte();
  const troca = await call("PATCH", `/api/users/${tmpUser.json.id}`, { cookie: ck("chefe_atendimento"), body: { password: novaSenha } });
  ok(troca.status === 200, "Chefe redefine a senha do operador");
  ok((await call("GET", "/api/requests", { cookie: tmpLogin.cookie })).status === 401, "Troca de senha encerra as sessões abertas do usuário");
  const tmpLogin2 = await login(call, tmp.email, novaSenha);
  ok((await call("GET", "/api/requests", { cookie: tmpLogin2.cookie })).status === 200, "Login com a nova senha funciona");
  tmpLogin.cookie = tmpLogin2.cookie;
  ok((await call("PATCH", `/api/users/${tmpUser.json.id}`, { cookie: ck("chefe_busca"), body: { ativo: false } })).status === 404, "Chefe da Busca não desativa usuário do Atendimento");
  const des = await call("PATCH", `/api/users/${tmpUser.json.id}`, { cookie: ck("chefe_atendimento"), body: { ativo: false } });
  ok(des.status === 200 && des.json?.ativo === false, "Chefe desativa o operador");
  ok((await call("GET", "/api/requests", { cookie: tmpLogin.cookie })).status === 401, "Usuário desativado perde a sessão na hora");
  ok((await call("POST", "/api/auth/login", { body: { email: tmp.email, password: tmp.password } })).status === 401, "Usuário desativado não faz login");
  ok((await call("PATCH", `/api/users/${S.gerente_arquivo.user.id}`, { cookie: ck("gerente_arquivo"), body: { ativo: false } })).status === 409, "Gerente não desativa a si mesmo");

  // ================= Limpeza =================
  for (const id of criados.filter(Boolean)) await call("DELETE", `/api/requests/${id}`, { cookie: ck("gerente_arquivo") });
  ok((await call("DELETE", `/api/requests/${A.id}`, { cookie: ck("chefe_atendimento") })).status === 403, "Só o Gerente usa a exclusão administrativa");
  ok((await detalhe("gerente_arquivo", A.id)).status === 404, "Pedidos de teste removidos");

  console.log(`\nResultado: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error("ERRO no teste:", e.stack || e.message);
  process.exit(2);
});
