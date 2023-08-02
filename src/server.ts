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
import { relatorioResolver } from "./relatorio/relatorio-resolver.js";

interface MyContext {
  token?: string;
}

(BigInt.prototype as any).toJSON = function () {
  const int = Number.parseInt(this.toString());
  return int ?? this.toString();
};

const app = express();
const httpServer = http.createServer(app);

const typeDefsMisc = await readFile("./schema.graphql", "utf-8");
const relatorioTypeDefs = await readFile("./src/relatorio/relatorio-schema.graphql", "utf-8");

const typeDefs = [typeDefsMisc, relatorioTypeDefs];

const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers: [miscResolvers, relatorioResolver],
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
