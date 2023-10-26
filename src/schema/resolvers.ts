import { atendimentoResolver } from "../modules/atendimento/atendimentoResolver.js";
import { produtorResolver } from "../modules/produtor/produtorResolver.js";
import { perfilResolver } from "../modules/perfil/perfilResolver.js";
import { usuarioResolver } from "../modules/usuario/usuarioResolver.js";

export const resolvers = [atendimentoResolver, produtorResolver, perfilResolver, usuarioResolver];
