import { GraphQLScalarType } from "graphql";
import { Kind } from "graphql/language/index.js";

const DateTime = new GraphQLScalarType({
  name: "DateTime",
  description: "A valid date time value",
  serialize(value: any): string {
    return (value as Date).toISOString();
  },
  parseValue(value: any): Date {
    return new Date(value as string);
  },
  parseLiteral(ast): Date | null {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

export default DateTime;
