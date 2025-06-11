import { AuthLdapService } from "./AuthLdapService.js";
import { UsuarioRepository } from "../repositories/prisma";
import { UsuarioDataMapper } from "../modules/usuario/UsuarioDataMapper.js";
import { UsuarioRepositoryOutputDto } from "@modules/usuario/dto/usuarioDTOs.js";

interface LoginProps {
  matricula_usuario: string;
  password: string;
}
export class LoginService {
  constructor(private readonly usuarioRepository: UsuarioRepository) {}

  async login({ matricula_usuario, password }: LoginProps) {
    if (!matricula_usuario || !password) {
      throw new Error("Usuário não encontrado");
    }

    const authenticated = await AuthLdapService.authenticate(
      matricula_usuario,
      password
    );
    if (!authenticated) throw new Error("Usuário não encontrado");

    const user = (await this.usuarioRepository.findMany({
      matricula_usuario,
    })) as UsuarioRepositoryOutputDto[];

    if (!user || user.length === 0) {
      throw new Error("Usuário não encontrado");
    }

    const usuarioLoginOutput = UsuarioDataMapper.toViewModel(user[0]);
    return usuarioLoginOutput;
  }
}
