  
import { env } from "../config/env.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set.");
}
const connectionString = env.DATABASE_URL;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
