import { atendimentoResolver as getAtendimentoResolver } from "../modules/atendimento/atendimentoResolver.js";
import { produtorResolver as getProdutorResolver } from "../modules/produtor/produtorResolver.js";
import { perfilResolver as getPerfilResolver } from "../modules/perfil/perfilResolver.js";
import { propriedadeResolver as getPropriedadeResolver } from "../modules/propriedade/propriedadeResolver.js";
import { usuarioResolver as getUsuarioResolver } from "../modules/usuario/usuarioResolver.js";
import {
  AtendimentoRepository,
  PerfilRepository,
  ProdutorRepository,
  PropriedadeRepository,
  UsuarioRepository,
} from "../repositories/prisma/index.js";

const atendimentoRepository = new AtendimentoRepository();
const produtorRepository = new ProdutorRepository();
const perfilRepository = new PerfilRepository();
const propriedadeRepository = new PropriedadeRepository();
const usuarioRepository = new UsuarioRepository();

const atendimentoResolver = getAtendimentoResolver(atendimentoRepository);
const produtorResolver = getProdutorResolver(produtorRepository);
const perfilResolver = getPerfilResolver(perfilRepository);
const propriedadeResolver = getPropriedadeResolver(propriedadeRepository);
const usuarioResolver = getUsuarioResolver(usuarioRepository);

export const resolvers = [
  atendimentoResolver,
  produtorResolver,
  perfilResolver,
  propriedadeResolver,
  usuarioResolver,
];
