/**
 * Regenerate sitemaps from the CLI.
 *
 *   npx tsx scripts/generate-sitemaps.ts --limit 1000
 *
 * --limit caps URLs per page type (creators/hashtags/niches). Launch with a
 * small seed batch and scale by raising the limit — never by changing code.
 * Defaults to SEO_PAGE_LIMIT or 1000.
 */
import "dotenv/config";
import { generateSitemaps } from "../lib/data/sitemaps";

function parseLimit(argv: string[]): number | undefined {
  const index = argv.indexOf("--limit");
  const value =
    index >= 0 ? argv[index + 1] : argv.find((a) => a.startsWith("--limit="));
  const raw = value?.replace("--limit=", "");
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`--limit must be a positive number, got "${raw}"`);
  }
  return Math.trunc(parsed);
}

const limit = parseLimit(process.argv.slice(2));
const result = await generateSitemaps({ limit });
console.log(
  `Generated ${result.files.length} sitemap file(s), ${result.totalUrls} URLs (limit ${result.limit}):`,
);
for (const file of result.files) {
  console.log(`  /sitemaps/${file.name} — ${file.urlCount} URLs`);
}
process.exit(0);
