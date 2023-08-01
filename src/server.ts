import http from "http";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { resolvers } from "./resolvers.js";
import { readFile } from "node:fs/promises";
import { auth } from "./auth/auth.js";

interface MyContext {
  token?: string;
}

const app = express();
const httpServer = http.createServer(app);

const typeDefs = await readFile("./schema.graphql", "utf-8");
const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers,
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
