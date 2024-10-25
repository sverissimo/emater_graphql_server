export interface Repository<T> {
  findOne: (...args: any[]) => void;
  findFirst?: (args: any) => void;
  findMany?: (...args: any) => void;
  findManyMinimal?: (...args: any) => void;
  findAll: () => void;
  findByProdutorId?: (produtorId: bigint, ...args: any[]) => void;
  getUnidadeEmpresa?: (produtorId: bigint) => void;
  create?: (input: any) => Promise<any>;
  createMany?: () => void;
  delete?: (id: number) => void;
  update?: (input: Partial<T> & any) => void;
  deleteMany?: () => void;
  updateMany?: (input: Partial<T>[]) => void;
  upsert?: () => void;
  count?: () => void;
}
