import {
  UsuarioLoginOutputDto,
  UsuarioRepositoryOutputDto,
} from "./dto/usuarioDTOs";

export class UsuarioDataMapper {
  static toViewModel(
    usuario: UsuarioRepositoryOutputDto
  ): UsuarioLoginOutputDto {
    const {
      id_usuario,
      matricula_usuario,
      digito_matricula,
      nome_usuario,
      login_usuario,
      id_und_empresa,
      ger_und_empresa,
    } = usuario;
    const perfis = usuario.perfil_demeter.map(
      (p) => p.perfil?.descricao_perfil
    );
    // A "G" unit is itself a regional, so it carries no parent regional to read.
    const unidadeId = ger_und_empresa?.id_und_empresa || id_und_empresa;
    const id_reg_empresa = unidadeId?.startsWith("G")
      ? unidadeId
      : ger_und_empresa?.ger_und_empresa?.id_und_empresa || null;

    return {
      id_usuario: id_usuario?.toString(),
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
