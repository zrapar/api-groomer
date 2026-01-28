import 'dotenv/config';
import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
          throw new Error('DATABASE_URL is not set');
        }
        const pool = new Pool({ connectionString });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DbModule {}
