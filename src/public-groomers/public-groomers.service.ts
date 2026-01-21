import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";

@Injectable()
export class PublicGroomersService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getBySlug(slug: string) {
    const [business] = await this.db
      .select()
      .from(schema.groomerBusinesses)
      .where(eq(schema.groomerBusinesses.slug, slug));

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    const services = await this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.businessId, business.id));

    return { business, services };
  }
}
