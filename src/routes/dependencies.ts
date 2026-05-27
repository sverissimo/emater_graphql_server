import { AtendimentoRepository } from "../modules/atendimento/repository/AtendimentoRepository.js";
import { EnumPropsRepository } from "../repositories/EnumPropsRepository.js";
import { UsuarioRepository } from "../modules/usuario/repository/UsuarioRepository.js";
import { LoginService } from "../auth/LoginService.js";
import { createPrismaClient } from "../config/prismaClient.js";

// Single Prisma client shared by every REST route group, wired once here.
const prismaClient = createPrismaClient();

export const atendimentoRepository = new AtendimentoRepository(prismaClient);
export const enumPropsRepository = new EnumPropsRepository(prismaClient);
export const usuarioRepository = new UsuarioRepository(prismaClient);
export const loginService = new LoginService(usuarioRepository);
