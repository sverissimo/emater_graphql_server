import http from "http";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { resolvers as miscResolvers } from "./resolvers.js";
import { readFile } from "node:fs/promises";
import { auth } from "./auth/auth.js";
import BigIntScalar from "./scalars/BigInt.js";
import DateTime from "./scalars/DateTime.js";
//import { relatorioResolver } from "./relatorio/relatorio-resolver.js";

interface MyContext {
  token?: string;
}

const app = express();
const httpServer = http.createServer(app);
const typeDefsMisc = await readFile("./schema.graphql", "utf-8");
//const relatorioTypeDefs = await readFile("./src/relatorio/relatorio-schema.graphql", "utf-8");
const typeDefs = [typeDefsMisc];
const scalars = { BigInt: BigIntScalar, DateTime: DateTime };

const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers: [scalars, miscResolvers],
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});

await server.start();
app.use(
  "/",
  cors<cors.CorsRequest>(),
  bodyParser.json(),
  auth,
  expressMiddleware(server, {
    context: async ({ res }) => ({ service: res.locals.service }),
  })
);

const PORT = 4000;
await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));

console.log(`🚀 Server ready at http://localhost:${PORT}/`);
