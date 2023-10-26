import { atendimentoResolver } from "../atendimento/atendimentoResolver.js";
import { resolvers as all } from "../resolvers.js";

export const resolvers = [atendimentoResolver, all];
