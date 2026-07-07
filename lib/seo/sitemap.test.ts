import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  passesCreatorQuality,
  passesHashtagQuality,
  SEO_QUALITY,
  SITEMAP_MAX_URLS,
} from "./config";
import {
  buildSitemapIndexXml,
  buildSitemapXml,
  chunkUrls,
  escapeXml,
  gzipXml,
  localizedLocs,
} from "./sitemap";

describe("quality gates", () => {
  it("publishes creator pages only at video and follower thresholds", () => {
    expect(passesCreatorQuality({ videoCount: 5, followerCount: 1000 })).toBe(
      true,
    );
    expect(passesCreatorQuality({ videoCount: 4, followerCount: 50_000 })).toBe(
      false,
    );
    expect(passesCreatorQuality({ videoCount: 20, followerCount: 999 })).toBe(
      false,
    );
  });

  it("publishes hashtag pages only at 50+ videos", () => {
    expect(passesHashtagQuality(SEO_QUALITY.hashtagMinVideos)).toBe(true);
    expect(passesHashtagQuality(49)).toBe(false);
  });
});

describe("chunkUrls", () => {
  it("splits at the 45k sitemap cap", () => {
    const urls = Array.from({ length: SITEMAP_MAX_URLS + 1 }, (_, i) => i);
    const chunks = chunkUrls(urls);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(SITEMAP_MAX_URLS);
    expect(chunks[1]).toHaveLength(1);
  });

  it("handles exact multiples and empty input", () => {
    expect(chunkUrls([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(chunkUrls([], 10)).toEqual([]);
  });
});

describe("XML builders", () => {
  it("escapes XML-hostile characters in locs", () => {
    expect(escapeXml(`a&b<c>"d'`)).toBe("a&amp;b&lt;c&gt;&quot;d&apos;");
    const xml = buildSitemapXml([{ loc: "https://x.test/hashtags/a&b" }]);
    expect(xml).toContain("<loc>https://x.test/hashtags/a&amp;b</loc>");
  });

  it("renders urlset entries with lastmod and changefreq", () => {
    const xml = buildSitemapXml([
      {
        loc: "https://x.test/creators/lanmoves",
        lastmod: "2026-07-07",
        changefreq: "daily",
      },
    ]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<lastmod>2026-07-07</lastmod>");
    expect(xml).toContain("<changefreq>daily</changefreq>");
  });

  it("renders a sitemap index pointing at numbered children", () => {
    const xml = buildSitemapIndexXml([
      { loc: "https://x.test/sitemaps/creators-1.xml" },
      { loc: "https://x.test/sitemaps/creators-2.xml" },
    ]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("/sitemaps/creators-2.xml");
  });
});

describe("gzipXml", () => {
  it("round-trips through gzip", () => {
    const xml = buildSitemapXml([{ loc: "https://x.test/creators/a" }]);
    const zipped = gzipXml(xml);
    expect(zipped.length).toBeLessThan(Buffer.byteLength(xml));
    expect(gunzipSync(zipped).toString("utf-8")).toBe(xml);
  });
});

describe("localizedLocs", () => {
  it("expands en at root plus vi/id prefixes", () => {
    expect(localizedLocs("https://x.test", "/creators/lanmoves")).toEqual([
      "https://x.test/creators/lanmoves",
      "https://x.test/vi/creators/lanmoves",
      "https://x.test/id/creators/lanmoves",
    ]);
  });
});
