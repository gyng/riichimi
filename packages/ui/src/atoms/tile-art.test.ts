import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Read the assets rather than a rendered tile. This is a property of what
// `scripts/tiles/prepare-tile-assets.py` emits, and jsdom drops the
// `filter: url(#…)` declaration that carries one of the real references, so a
// DOM test would report an id as dead when the art genuinely uses it.
const directory = fileURLToPath(new URL("../../assets/tiles", import.meta.url));
const files = readdirSync(directory).filter((name) => name.endsWith(".svg"));

function ids(markup: string): string[] {
  return [...markup.matchAll(/id="([^"]+)"/g)].map((match) => match[1] ?? "");
}

function referenced(markup: string): Set<string> {
  return new Set([
    ...[...markup.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1] ?? ""),
    ...[...markup.matchAll(/href="#([^"]+)"/g)].map((match) => match[1] ?? ""),
  ]);
}

describe("tile art", () => {
  it("ships one file per tile", () => {
    expect(files).toHaveLength(37);
  });

  it("carries no id that nothing in the file references", () => {
    // Inkscape names every shape it ever touched. Those dead ids were 1,566 of
    // the set's 1,689, and because SVG ids share one document-wide namespace,
    // they are also most of what repeats when the same tile renders twice. The
    // generator drops them; a regenerated asset must not bring them back.
    const dead = files.flatMap((name) => {
      const markup = readFileSync(`${directory}/${name}`, "utf8");
      const used = referenced(markup);
      return ids(markup)
        .filter((id) => !used.has(id))
        .map((id) => `${name}: ${id}`);
    });

    expect(dead).toEqual([]);
  });

  it("gives each tile its own id namespace, so two tiles never collide", () => {
    // One page shows many tiles at once. Without a per-tile prefix, one tile's
    // mask silently applies to another's.
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const name of files) {
      for (const id of ids(readFileSync(`${directory}/${name}`, "utf8"))) {
        const owner = seen.get(id);
        if (owner !== undefined) {
          collisions.push(`${id} in both ${owner} and ${name}`);
        }
        seen.set(id, name);
      }
    }

    expect(collisions).toEqual([]);
  });
});
