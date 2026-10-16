import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";

type AssetEntry = { src: string; width: number; height: number; alt: string };

const assets = Object.values(TURNMARK_ASSETS).flatMap((category) => Object.values(category)) as AssetEntry[];

describe("approved TuRnMaRk assets", () => {
  it("keeps a unique allowlist of approved public assets", () => {
    expect(assets).toHaveLength(20);
    expect(new Set(assets.map((asset) => asset.src)).size).toBe(assets.length);
    expect(assets.every((asset) => asset.src.startsWith("/assets/turnmark/"))).toBe(true);
  });

  it.each(assets)("matches the declared PNG metadata for $src", (asset) => {
    const file = readFileSync(join(process.cwd(), "public", asset.src));
    const png = PNG.sync.read(file);
    expect(png.width).toBe(asset.width);
    expect(png.height).toBe(asset.height);
    expect(png.alpha).toBe(true);
    expect(asset.alt.trim().length).toBeGreaterThan(0);
  });
});
