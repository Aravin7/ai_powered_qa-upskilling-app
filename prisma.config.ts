import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({
 schema: 'prisma/schema.prisma',
 migrations: { path: 'prisma/migrations' },
 datasource: { url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://qa:qa_local_only@localhost:5432/qa_pathway' }
});
