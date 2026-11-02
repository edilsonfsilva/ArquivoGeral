import { z } from "zod";

// ------------------------------------------------------------------
// Constantes de domínio
// ------------------------------------------------------------------
export const STATUS = ["novo", "em_analise", "aprovado", "indeferido"];
export const ROLES = ["admin", "atendente"];
export const MAX_FILE_MB = 5;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg"];

// ------------------------------------------------------------------
// Validadores
// ------------------------------------------------------------------
export function isValidCpf(value) {
  const cpf = String(value || "").replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

// Número Único de Processo (Res. CNJ 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO
export function isValidNpu(value) {
  const d = String(value || "").replace(/\D/g, "");
  if (d.length !== 20) return false;
  const n = d.slice(0, 7);
  const dv = Number(d.slice(7, 9));
  const resto = d.slice(9);
  const calc = 98 - Number(BigInt(n + resto + "00") % 97n);
  return calc === dv;
}

// Neutraliza injeção de fórmula ao exportar para CSV/Excel.
export function csvCell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

const texto = (min, max, msg) => z.string().trim().min(min, msg).max(max, `Máximo de ${max} caracteres`);
const opcional = (max) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

// ------------------------------------------------------------------
// Campos da solicitação (comuns ao formulário público e ao servidor)
// ------------------------------------------------------------------
export const requestFields = {
  nomeCompleto: texto(3, 150, "Nome completo é obrigatório"),
  cpf: z.string().trim().refine(isValidCpf, "CPF inválido"),
  whatsapp: z
    .string()
    .trim()
    .refine((v) => /^\d{10,11}$/.test(v.replace(/\D/g, "")), "Número de WhatsApp inválido"),
  email: z.string().trim().max(254).email("E-mail inválido"),
  oab: opcional(30),
  tipoNumeracao: z.enum(["npu", "tombo"], { required_error: "Selecione o tipo de numeração" }),
  numeroProcesso: texto(1, 60, "Número do processo é obrigatório"),
  partes: texto(3, 500, "Informe as partes do processo"),
  comarca: texto(2, 120, "Informe a comarca"),
  varaUnidade: texto(2, 160, "Informe a vara ou unidade judiciária"),
  segredoJustica: z.enum(["sim", "nao"], { required_error: "Informe se há segredo de justiça" }),
  observacao: opcional(2000)
};

const npuRefine = (data, ctx) => {
  if (data.tipoNumeracao === "npu" && data.numeroProcesso && !isValidNpu(data.numeroProcesso)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["numeroProcesso"],
      message: "Número NPU inválido (dígito verificador não confere)"
    });
  }
};

// Anexo enviado como base64 no JSON (validado de novo no servidor pelos "magic bytes").
const anexoSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.enum(ACCEPTED_FILE_TYPES),
    base64: z.string().min(1).max(Math.ceil((MAX_FILE_BYTES * 4) / 3) + 8)
  })
  .optional()
  .nullable();

export const publicRequestSchema = z
  .object({ ...requestFields, anexo: anexoSchema })
  .strict()
  .superRefine(npuRefine);

// Edição pelo administrador: só campos de negócio, nunca protocolo/data/anexo.
export const adminUpdateRequestSchema = z
  .object({
    ...Object.fromEntries(Object.entries(requestFields).map(([k, v]) => [k, v.optional()])),
    status: z.enum(STATUS).optional()
  })
  .strict();

export const statusUpdateSchema = z.object({ status: z.enum(STATUS) }).strict();

export const observationSchema = z.object({ text: texto(1, 2000, "Observação vazia") }).strict();

const senha = z
  .string()
  .min(10, "A senha deve ter pelo menos 10 caracteres")
  .max(128, "Senha muito longa");

export const createUserSchema = z
  .object({
    name: texto(2, 120, "Nome é obrigatório"),
    email: z.string().trim().toLowerCase().max(254).email("E-mail inválido"),
    password: senha,
    role: z.enum(ROLES).default("atendente")
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: texto(2, 120, "Nome é obrigatório").optional(),
    email: z.string().trim().toLowerCase().max(254).email("E-mail inválido").optional(),
    password: z.union([senha, z.literal("")]).optional(),
    role: z.enum(ROLES).optional()
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254).email(),
    password: z.string().min(1).max(128)
  })
  .strict();
