import { createPrismaClient } from "../src/config/prismaClient.js";

const prisma = createPrismaClient();

async function main() {
  console.log("## Seed skipped, using existing data from testDB...");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
