import http from "http";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import BigIntScalar from "./shared/scalars/BigInt.js";
import DateTime from "./shared/scalars/DateTime.js";
import { typeDefs } from "./schema/typedefs.js";
import { resolvers } from "./schema/resolvers.js";
import { app } from "./app.js";
import { logger } from "./shared/utils/logger.js";
import type { RequestHandler } from "express";
import { expressMiddleware } from "@as-integrations/express5";

interface MyContext {
  token?: string;
}

const { PORT } = process.env;

const scalars = { BigInt: BigIntScalar, DateTime: DateTime };
const httpServer = http.createServer(app);
export const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers: [scalars, ...resolvers],
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});
await server.start();
const apolloMiddleware: RequestHandler = expressMiddleware(server, {
  context: async ({ res }) => ({ service: res.locals.service }),
}) as unknown as RequestHandler;

app.use(apolloMiddleware);

httpServer.listen(PORT, () =>
  logger.info(`🚀 Server listening on port ${PORT}...`)
);
