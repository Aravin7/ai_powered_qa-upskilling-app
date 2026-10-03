import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const globalDb = globalThis as unknown as { qaDb?: PrismaClient };
export function db() {
 if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
 if (!globalDb.qaDb) globalDb.qaDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 }) });
 return globalDb.qaDb;
}
