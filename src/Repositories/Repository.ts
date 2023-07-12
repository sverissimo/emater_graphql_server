export interface Repository {
  findOne: (...args: any[]) => void;
  findFirst?: () => void;
  findAll: () => void;
  create?: () => void;
  createMany?: () => void;
  delete?: () => void;
  update?: () => void;
  deleteMany?: () => void;
  updateMany?: () => void;
  upsert?: () => void;
  count?: () => void;
}
