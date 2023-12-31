import http from "http";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import BigIntScalar from "./shared/scalars/BigInt.js";
import DateTime from "./shared/scalars/DateTime.js";
import { typeDefs } from "./schema/typedefs.js";
import { resolvers } from "./schema/resolvers.js";
import { app } from "./app.js";

interface MyContext {
  token?: string;
}
const PORT = process.env.PORT || 4000;
const scalars = { BigInt: BigIntScalar, DateTime: DateTime };
const httpServer = http.createServer(app);
export const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers: [scalars, ...resolvers],
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});

await server.start();
app.use(
  expressMiddleware(server, {
    context: async ({ res }) => ({ service: res.locals.service }),
  })
);

httpServer.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}...`));
