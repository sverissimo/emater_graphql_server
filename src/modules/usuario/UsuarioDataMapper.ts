import { UsuarioRepositoryOutputDto } from "./dto/usuarioDTOs";

export class UsuarioDataMapper {
  static toViewModel(usuario: UsuarioRepositoryOutputDto) {
    const {
      id_usuario,
      matricula_usuario,
      digito_matricula,
      nome_usuario,
      login_usuario,
      id_und_empresa,
      ger_und_empresa,
    } = usuario;
    const perfis = usuario.perfil_demeter.map((p) => p.perfil?.descricao_perfil);
    const id_reg_empresa = ger_und_empresa?.ger_und_empresa?.id_und_empresa;

    return {
      id_usuario,
      matricula_usuario,
      digito_matricula,
      nome_usuario,
      login_usuario,
      id_und_empresa,
      id_reg_empresa,
      perfis,
    };
  }
}
