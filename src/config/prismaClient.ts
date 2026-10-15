import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create PrismaClient.");
  }

  return databaseUrl;
}

export function createPrismaClient(
  poolConfig: Omit<PoolConfig, "connectionString"> = {},
) {
  const adapter = new PrismaPg({
    ...poolConfig,
    connectionString: getDatabaseUrl(),
  });

  return new PrismaClient({
    adapter,
    log: ["info", "warn", "error"],
  });
}

export const prismaClient = createPrismaClient();
