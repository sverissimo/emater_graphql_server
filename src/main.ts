import http from "http";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import BigIntScalar from "./shared/scalars/BigInt.js";
import DateTime from "./shared/scalars/DateTime.js";
import { typeDefs } from "./schema/typedefs.js";
import { resolvers } from "./schema/resolvers.js";
import { app } from "./app.js";
import { logger } from "./shared/utils/logger.js";
import { configDotenv } from "dotenv";

interface MyContext {
  token?: string;
}

configDotenv();

const { NODE_ENV, DEV_PORT, PROD_PORT } = process.env;
const PORT = NODE_ENV === "production" ? Number(PROD_PORT) : Number(DEV_PORT);

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

httpServer.listen(PORT, () => logger.info(`🚀 Server listening on port ${PORT}...`));
