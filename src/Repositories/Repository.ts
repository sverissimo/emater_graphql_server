export interface Repository<T> {
  findOne: (...args: any[]) => void;
  findFirst?: () => void;
  findAll: () => void;
  create?: (input: T) => void;
  createMany?: () => void;
  delete?: (id: number) => void;
  update?: (input: T & { id: number }) => void;
  deleteMany?: () => void;
  updateMany?: () => void;
  upsert?: () => void;
  count?: () => void;
}
