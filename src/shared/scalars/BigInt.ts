import { GraphQLScalarType } from "graphql";
import { Kind } from "graphql/language/index.js";

const BigIntScalar = new GraphQLScalarType({
  name: "BigInt",
  description: "A valid BigInt value",
  serialize(value: any): string {
    return (value as bigint).toString();
  },
  parseValue(value: any): bigint {
    return BigInt(value as string);
  },
  parseLiteral(ast): bigint | null {
    if (ast.kind === Kind.STRING) {
      return BigInt(ast.value);
    }
    return null;
  },
});

export default BigIntScalar;
