import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidCpf,
  isValidNpu,
  csvCell,
  publicRequestSchema,
  acaoSchema,
  certidaoSchema,
  consultaSchema,
  listFiltersSchema,
  createUserSchema,
  updateUserSchema
} from "../shared/validation.js";

const dv = 98 - Number(BigInt("0001234" + "20248170001" + "00") % 97n);
const NPU = `0001234-${String(dv).padStart(2, "0")}.2024.8.17.0001`;

test("CPF, NPU e CSV", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidNpu(NPU), true);
  assert.equal(isValidNpu("0001234-00.2024.8.17.0002"), false);
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
});

test("formulário público continua estrito", () => {
  const ok = {
    nomeCompleto: "Maria Teste",
    cpf: "529.982.247-25",
    whatsapp: "(81) 99999-0000",
    email: "m@x.com",
    tipoNumeracao: "npu",
    numeroProcesso: NPU,
    partes: "A vs B",
    comarca: "Recife",
    varaUnidade: "1ª Vara",
    segredoJustica: "nao"
  };
  assert.equal(publicRequestSchema.safeParse(ok).success, true);
  assert.equal(publicRequestSchema.safeParse({ ...ok, status: "arquivado" }).success, false);
});

test("acaoSchema", () => {
  assert.equal(acaoSchema.safeParse({ acao: "localizar" }).success, true);
  assert.equal(acaoSchema.safeParse({ acao: "atribuir_busca", responsavelId: 3 }).success, true);
  assert.equal(acaoSchema.safeParse({ acao: "voar" }).success, false);
  assert.equal(acaoSchema.safeParse({ acao: "localizar", status: "arquivado" }).success, false);
  assert.equal(acaoSchema.safeParse({ acao: "atribuir_busca", responsavelId: -1 }).success, false);
  assert.equal(acaoSchema.parse({ acao: "indeferir", nota: "   " }).nota, null);
});

test("certidaoSchema", () => {
  assert.equal(certidaoSchema.safeParse({ tipo: "desarquivamento" }).success, true);
  assert.equal(certidaoSchema.safeParse({ tipo: "inteiro_teor" }).success, false);
});

test("consultaSchema normaliza protocolo e exige CPF válido", () => {
  assert.equal(consultaSchema.parse({ protocolo: " ag-123456 ", cpf: "529.982.247-25" }).protocolo, "AG-123456");
  assert.equal(consultaSchema.safeParse({ protocolo: "AG-12", cpf: "529.982.247-25" }).success, false);
  assert.equal(consultaSchema.safeParse({ protocolo: "AG-123456", cpf: "111.111.111-11" }).success, false);
});

test("listFiltersSchema", () => {
  assert.deepEqual(listFiltersSchema.parse({ status: "em_busca", operadorId: "4", lixo: "x" }), {
    status: "em_busca",
    operadorId: 4
  });
  assert.equal(listFiltersSchema.safeParse({ status: "novo" }).success, false);
  assert.equal(listFiltersSchema.safeParse({ de: "2026-13" }).success, false);
});

test("usuários: perfil novo e matrícula obrigatória", () => {
  const base = { name: "Ana", email: "Ana@X.com", matricula: "12345", password: "senha-forte-1", role: "operador_busca" };
  assert.equal(createUserSchema.parse(base).email, "ana@x.com");
  assert.equal(createUserSchema.safeParse({ ...base, role: "admin" }).success, false);
  assert.equal(createUserSchema.safeParse({ ...base, matricula: "" }).success, false);
  assert.equal(createUserSchema.safeParse({ ...base, password: "curta" }).success, false);
  assert.equal(updateUserSchema.safeParse({ ativo: false }).success, true);
  assert.equal(updateUserSchema.safeParse({ ativo: "nao" }).success, false);
});

import { modeloCertidaoSchema } from "../shared/validation.js";

test("Q9: segredo de justiça exige OAB ou procuração no formulário", () => {
  const base = {
    nomeCompleto: "Maria Teste", cpf: "529.982.247-25", whatsapp: "(81) 99999-0000", email: "m@x.com",
    tipoNumeracao: "tombo", numeroProcesso: "123", partes: "A vs B", comarca: "Recife", varaUnidade: "1ª Vara",
    segredoJustica: "sim"
  };
  const r = publicRequestSchema.safeParse(base);
  assert.equal(r.success, false);
  assert.match(JSON.stringify(r.error.issues), /segredo de justiça/i);
  assert.equal(publicRequestSchema.safeParse({ ...base, oab: "PE-12345" }).success, true);
  assert.equal(
    publicRequestSchema.safeParse({ ...base, anexo: { name: "p.pdf", type: "application/pdf", base64: "JVBERi0=" } }).success,
    true
  );
});

test("modelo de certidão", () => {
  assert.equal(modeloCertidaoSchema.safeParse({ titulo: "Certidão X", texto: "CERTIFICO que o processo {processo} foi localizado." }).success, true);
  assert.equal(modeloCertidaoSchema.safeParse({ titulo: "", texto: "x" }).success, false);
  assert.equal(modeloCertidaoSchema.safeParse({ titulo: "Ok título", texto: "CERTIFICO algo suficiente.", extra: 1 }).success, false);
});
