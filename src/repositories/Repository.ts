export interface Repository<T> {
  findOne: (...args: any[]) => void;
  findFirst?: (args: any) => void;
  findMany?: (...args: any) => void;
  findAll: () => void;
  findByProdutorId?: (produtorId: bigint) => void;
  getUnidadeEmpresa?: (produtorId: bigint) => void;
  create?: (input: any) => Promise<any>;
  createMany?: () => void;
  delete?: (id: number) => void;
  update?: (input: Partial<T> & any) => void;
  deleteMany?: () => void;
  updateMany?: () => void;
  upsert?: () => void;
  count?: () => void;
}

/*

Property 'findMany' in type 'UsuarioRepository' is not assignable to the same property in base type 'Repository<GetResult<{ id_usuario: bigint; login_usuario: string; nome_usuario: string | null; email_usuario: string | null; celular_usuario: string | null; token_demeter: string; data_cadastro: Date; ... 10 more ...; dt_update_record: Date | null; }, unknown> & {}>'.
  Type '({ id, matricula_usuario }: { id?: string | undefined; matricula_usuario?: string | undefined; }) => Promise<({ perfil_demeter: ({ perfil: GetResult<{ id_perfil: bigint; descricao_perfil: string; dt_update_record: Date | null; }, unknown> & {}; } & GetResult<...> & {})[]; } & GetResult<...> & {})[] | undefined>' is not assignable to type '(args: any) => Promise<(GetResult<{ id_usuario: bigint; login_usuario: string; nome_usuario: string | null; email_usuario: string | null; celular_usuario: string | null; token_demeter: string; ... 11 more ...; dt_update_record: Date | null; }, unknown> & {})[]>'.
    Type 'Promise<({ perfil_demeter: ({ perfil: GetResult<{ id_perfil: bigint; descricao_perfil: string; dt_update_record: Date | null; }, unknown> & {}; } & GetResult<{ id_perfil: bigint; id_usuario: bigint; dt_update_record: Date | null; }, unknown> & {})[]; } & GetResult<...> & {})[] | undefined>' is not assignable to type 'Promise<(GetResult<{ id_usuario: bigint; login_usuario: string; nome_usuario: string | null; email_usuario: string | null; celular_usuario: string | null; token_demeter: string; data_cadastro: Date; ... 10 more ...; dt_update_record: Date | null; }, unknown> & {})[]>'.
      Type '({ perfil_demeter: ({ perfil: GetResult<{ id_perfil: bigint; descricao_perfil: string; dt_update_record: Date | null; }, unknown> & {}; } & GetResult<{ id_perfil: bigint; id_usuario: bigint; dt_update_record: Date | null; }, unknown> & {})[]; } & GetResult<...> & {})[] | undefined' is not assignable to type '(GetResult<{ id_usuario: bigint; login_usuario: string; nome_usuario: string | null; email_usuario: string | null; celular_usuario: string | null; token_demeter: string; data_cadastro: Date; ... 10 more ...; dt_update_record: Date | null; }, unknown> & {})[]'.

Type 'undefined' is not assignable to type
'(GetResult<{ id_usuario: bigint; login_usuario: string; nome_usuario: string | null; email_usuario: string | null; celular_usuario: string | null; token_demeter: string; data_cadastro: Date; ... 10 more ...; dt_update_record: Date | null; }, unknown> & {})[]'.
*/
