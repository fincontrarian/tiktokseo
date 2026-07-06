import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Optional at generate time; required for migrate/introspection commands.
    url: process.env.DATABASE_URL,
  },
});
