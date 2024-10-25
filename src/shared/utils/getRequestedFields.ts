import { GraphQLResolveInfo } from "graphql";

export function getRequestedFields(info: GraphQLResolveInfo) {
  return info.fieldNodes[0].selectionSet?.selections.map(
    (selection) => (selection as any).name.value
  );
}
