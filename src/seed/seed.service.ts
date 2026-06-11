import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_DB } from '../db/db.module';
import * as schema from '../db/schema';
import { runSeed } from '../db/seed';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async onApplicationBootstrap() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await runSeed(this.db as any);
    } catch (error) {
      this.logger.error(`Seed failed: ${(error as Error).message}`);
    }
  }
}
