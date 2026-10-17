import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";

type AssetEntry = { src: string; width: number; height: number; alt: string };

const assets = Object.values(TURNMARK_ASSETS).flatMap((category) => Object.values(category)) as AssetEntry[];

describe("approved TuRnMaRk assets", () => {
  it("keeps a unique allowlist of approved public assets", () => {
    expect(assets).toHaveLength(24);
    expect(new Set(assets.map((asset) => asset.src)).size).toBe(assets.length);
    expect(assets.every((asset) => asset.src.startsWith("/assets/turnmark/"))).toBe(true);
  });

  it.each(assets)("matches the declared asset metadata for $src", (asset) => {
    const file = readFileSync(join(process.cwd(), "public", asset.src));
    if (asset.src.endsWith(".png")) {
      const png = PNG.sync.read(file);
      expect(png.width).toBe(asset.width);
      expect(png.height).toBe(asset.height);
      expect(png.alpha).toBe(true);
    } else {
      expect([...file.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    }
    expect(asset.alt.trim().length).toBeGreaterThan(0);
  });
});

describe("TuRnMaRk design tokens", () => {
  it("keeps the approved palette and gradients in the global token source", () => {
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8").toLowerCase();
    for (const value of ["#ff6b2b", "#ff4765", "#7c3aed", "#fffaf7", "#111318", "#ffffff"]) {
      expect(css).toContain(value);
    }
    expect(css).toContain("linear-gradient(135deg, #ff6b2b 0%, #ff4765 100%)");
    expect(css).toContain("linear-gradient(135deg, #7c3aed 0%, #ff4765 100%)");
  });
});
