export interface Repository<T> {
  findOne: (...args: any[]) => void;
  findFirst?: () => void;
  findAll: () => void;
  create?: (input: any) => void;
  createMany?: () => void;
  delete?: (id: number) => void;
  update?: (id: number, input: T) => void;
  deleteMany?: () => void;
  updateMany?: () => void;
  upsert?: () => void;
  count?: () => void;
}
