import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
//const connectionString = `${process.env.DATABASE_URL}`;
const connectionString =
  "postgresql://postgres:SuperstarA223@localhost:5432/ReaktorRPS?schema=public";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
