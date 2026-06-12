import type { CreateProdutorDTO } from "./dto/CreateProdutorDTO.js";

// Defensive boundary validation + CPF normalization for createProdutor. Malformed input is already
// guarded upstream, so failures here are rare; when one happens the resolver catches the thrown
// ProdutorValidationError, logs once, and returns null (silent failure — see the plan's
// "Error handling and logging (silent failure)"). The DTO is a shape contract, not a validator.

export class ProdutorValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProdutorValidationError";
  }
}

// Max lengths from the @db.VarChar(N)/@db.Char(N) annotations on ger_pessoa / ger_end_pessoa / pl_propriedade.
const MAX_LENGTHS = {
  nome: 100,
  email: 80,
  identidade: 15,
  tpSexo: 1,
  logradouro: 100,
  numero: 15,
  complemento: 80,
  bairro: 80,
  cep: 8,
  nomePropriedade: 100,
  geoPontoTexto: 255,
  unidadeEmpresa: 5,
} as const;

// area_total is Decimal(13,4): 9 integer digits max.
const MAX_AREA_TOTAL = 1e9;

/** Transform — strips all non-digits. Runs on every call; the unique constraint needs normalized digits. */
export const normalizeCpf = (raw: string): string => (raw ?? "").replace(/\D/g, "");

/**
 * Normalize a phone to 10/11 digits (DDD + number). Accepts digits with () spaces - and a leading
 * +55; strips a 55 country code only at 12-13 digits. Throws ProdutorValidationError on anything
 * else (the create path turns the throw into a silent null). Callers skip this when telefone is absent.
 */
export const normalizePhone = (raw: string): string => {
  const cleaned = (raw ?? "").trim();
  if (
    cleaned === "" ||
    !/^\+?[\d() -]+$/.test(cleaned) ||
    (cleaned.startsWith("+") && !cleaned.startsWith("+55"))
  ) {
    throw new ProdutorValidationError("telefone contém caracteres inválidos");
  }
  let digits = cleaned.replace(/\D/g, "");
  if (digits.length >= 12 && digits.length <= 13 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (!/^\d{10,11}$/.test(digits)) {
    throw new ProdutorValidationError("telefone inválido");
  }
  return digits;
};

/** CPF check-digit validation on the 11-digit normalized form. */
export const isValidCpf = (digits: string): boolean => {
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // reject all-equal digits (passes the checksum otherwise)
  const checkDigit = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
};

const requireNonBlank = (value: string | null | undefined, field: string): void => {
  if (value == null || value.trim() === "") {
    throw new ProdutorValidationError(`Campo obrigatório ausente ou vazio: ${field}`);
  }
};

const checkMaxLength = (value: string | null | undefined, max: number, field: string): void => {
  if (value != null && value.length > max) {
    throw new ProdutorValidationError(`Campo ${field} excede ${max} caracteres`);
  }
};

/**
 * Validate the boundary and normalize the scalars it owns: `cpf` reduced to digits and, when
 * present, `telefone` reduced to its 10/11-digit form. Returns the normalized input.
 * Throws ProdutorValidationError on any failure.
 */
export const validateAndNormalize = (input: CreateProdutorDTO): CreateProdutorDTO => {
  requireNonBlank(input.nome, "nome");
  requireNonBlank(input.cpf, "cpf");
  requireNonBlank(input.unidadeEmpresa, "unidadeEmpresa");

  // Reject anything other than digits and permitted CPF formatting (. - space) BEFORE stripping,
  // so garbage like "abc529.982.247-25xyz" fails instead of being laundered into a valid CPF.
  if (!/^[\d. -]+$/.test(input.cpf)) {
    throw new ProdutorValidationError("CPF contém caracteres inválidos");
  }
  const cpf = normalizeCpf(input.cpf);
  if (!isValidCpf(cpf)) throw new ProdutorValidationError("CPF inválido");

  if (!Number.isInteger(input.municipioId) || input.municipioId <= 0) {
    throw new ProdutorValidationError("municipioId inválido");
  }

  checkMaxLength(input.nome, MAX_LENGTHS.nome, "nome");
  checkMaxLength(input.email, MAX_LENGTHS.email, "email");
  checkMaxLength(input.identidade, MAX_LENGTHS.identidade, "identidade");
  checkMaxLength(input.tpSexo, MAX_LENGTHS.tpSexo, "tpSexo");

  const endereco = input.endereco;
  if (endereco) {
    checkMaxLength(endereco.logradouro, MAX_LENGTHS.logradouro, "logradouro");
    checkMaxLength(endereco.numero, MAX_LENGTHS.numero, "numero");
    checkMaxLength(endereco.complemento, MAX_LENGTHS.complemento, "complemento");
    checkMaxLength(endereco.bairro, MAX_LENGTHS.bairro, "bairro");
    checkMaxLength(endereco.cep, MAX_LENGTHS.cep, "cep");
  }

  const propriedade = input.propriedade;
  if (propriedade) {
    requireNonBlank(propriedade.nome, "propriedade.nome");
    requireNonBlank(propriedade.unidadeEmpresa, "propriedade.unidadeEmpresa");
    checkMaxLength(propriedade.nome, MAX_LENGTHS.nomePropriedade, "propriedade.nome");
    checkMaxLength(
      propriedade.geoPontoTexto,
      MAX_LENGTHS.geoPontoTexto,
      "propriedade.geoPontoTexto",
    );
    checkMaxLength(
      propriedade.unidadeEmpresa,
      MAX_LENGTHS.unidadeEmpresa,
      "propriedade.unidadeEmpresa",
    );
    if (
      !Number.isInteger(propriedade.municipioId) ||
      propriedade.municipioId <= 0
    ) {
      throw new ProdutorValidationError("propriedade.municipioId inválido");
    }
    if (
      propriedade.areaTotal != null &&
      (!Number.isFinite(propriedade.areaTotal) ||
        propriedade.areaTotal <= 0 ||
        propriedade.areaTotal >= MAX_AREA_TOTAL)
    ) {
      throw new ProdutorValidationError("propriedade.areaTotal inválida");
    }
  }

  const telefone =
    input.telefone != null ? normalizePhone(input.telefone) : input.telefone;

  return { ...input, cpf, telefone };
};
