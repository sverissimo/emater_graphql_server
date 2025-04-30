import { ger_und_empresa, Usuario } from "@prisma/client";

interface PerfilDemeter {
  perfil: {
    descricao_perfil: string;
  };
}

export interface UsuarioRepositoryOutputDto extends Usuario {
  ger_und_empresa: {
    nm_und_empresa: string;
    id_und_empresa: string;
    ger_und_empresa?: ger_und_empresa;
  };
  perfil_demeter: PerfilDemeter[];
}

export interface UsuarioLoginOutputDto {
  id_usuario?: string;
  login_usuario?: string;
  nome_usuario?: string;
  email_usuario?: string | null;
  celular_usuario?: string | null;
  matricula_usuario?: string | null;
  digito_matricula?: string | null;
  id_und_empresa?: string | null;
  id_reg_empresa?: string | null;
  sexo_usuario?: string | null;
  perfis: string[];
}
