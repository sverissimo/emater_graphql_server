export const serializeBigInts = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInts);
  if (typeof obj === "object") {
    const newObj = {} as typeof obj;
    for (const key in obj) {
      newObj[key] = serializeBigInts(obj[key]);
    }
    return newObj;
  }
  return obj;
};
