import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { auth } from "./auth/auth.js";
import { RESTAPIRoutes } from "./routes.js";

const app = express();
app.use(cors<cors.CorsRequest>());
app.use(bodyParser.json());
app.use(auth);
app.use("/api", RESTAPIRoutes);

export { app };
