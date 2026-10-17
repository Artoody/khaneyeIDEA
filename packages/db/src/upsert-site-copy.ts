/**
 * Insert missing pageBlocks / FAQs / published reviews / partners without wiping demo data.
 *   DATABASE_URL=... pnpm --filter @khaneyeidea/db upsert-site-copy
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { PAGE_BLOCKS, SITE_FAQS, SITE_PARTNERS, SITE_REVIEWS } from "./seed/data";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), override: false });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const sql = postgres(url, { max: 1, prepare: false, ssl: url.includes("rlwy.net") ? "require" : undefined });
const slug = process.env.DEFAULT_TENANT_SLUG ?? "khaneyeide";

try {
  const [tenant] = await sql<{ id: string }[]>`select id from tenants where slug = ${slug} limit 1`;
  if (!tenant) throw new Error(`tenant ${slug} missing`);
  const tenantId = tenant.id;

  let blocksAdded = 0;
  for (const [key, value] of Object.entries(PAGE_BLOCKS)) {
    const [have] = await sql`select key from page_blocks where tenant_id = ${tenantId} and key = ${key} limit 1`;
    if (have) continue;
    await sql`
      insert into page_blocks (tenant_id, key, value)
      values (${tenantId}, ${key}, ${sql.json(value)})
    `;
    blocksAdded++;
  }

  const [faqHave] = await sql`select id from faqs where tenant_id = ${tenantId} limit 1`;
  let faqsAdded = 0;
  if (!faqHave) {
    for (const [i, f] of SITE_FAQS.entries()) {
      await sql`
        insert into faqs (tenant_id, category, question, answer, active, sort_order)
        values (${tenantId}, ${"about"}, ${sql.json(f.question)}, ${sql.json(f.answer)}, ${true}, ${i})
      `;
      faqsAdded++;
    }
  }

  const [reviewHave] = await sql`select id from site_reviews where tenant_id = ${tenantId} limit 1`;
  let reviewsAdded = 0;
  if (!reviewHave) {
    for (const [i, r] of SITE_REVIEWS.entries()) {
      await sql`
        insert into site_reviews (tenant_id, author_name, body, status, featured, sort_order)
        values (${tenantId}, ${sql.json(r.authorName)}, ${sql.json(r.body)}, ${"published"}, ${true}, ${i})
      `;
      reviewsAdded++;
    }
  }

  const [partnerHave] = await sql`select id from partners where tenant_id = ${tenantId} limit 1`;
  let partnersAdded = 0;
  if (!partnerHave) {
    for (const [i, p] of SITE_PARTNERS.entries()) {
      await sql`
        insert into partners (tenant_id, name, logo_url, url, active, sort_order)
        values (${tenantId}, ${sql.json(p.name)}, ${p.logoUrl}, ${p.url ?? null}, ${true}, ${i})
      `;
      partnersAdded++;
    }
  }

  console.log(
    `upsert-site-copy: +${blocksAdded} pageBlocks, +${faqsAdded} faqs, +${reviewsAdded} reviews, +${partnersAdded} partners (tenant ${slug})`,
  );
} finally {
  await sql.end({ timeout: 5 });
}
