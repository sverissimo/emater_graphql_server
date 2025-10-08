import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { GraphQLError } from "graphql";

export const auth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (process.env.NODE_ENV === "development") {
    return next();
  }
  if (req.method === "POST" && req.path.match("/login")) {
    return next();
  }

  let authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(403).send("Invalid service token.");
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(
      token,
      process.env.SERVICE_TOKEN!
    ) as JwtPayload & {
      service?: string;
    };
    res.locals.service = decoded?.service;
    next();
  } catch (error) {
    res.send(
      new GraphQLError("Não autorizado.", { extensions: { code: "FORBIDDEN" } })
    );
  }
};
