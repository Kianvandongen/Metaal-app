import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { bereken } from "./engine";
import type { CalculatieInvoer } from "./types";

/**
 * Regressie tegen echte calculatiebladen van de klant. Die bevatten bedrijfsgegevens en staan
 * daarom niet in de repo: zet PRIVATE_FIXTURES_DIR naar een map met JSON-bestanden gemaakt met
 * scripts/excel_naar_fixture.py. Zonder die map wordt deze test overgeslagen.
 */
const dir = process.env.PRIVATE_FIXTURES_DIR;
const bestanden = dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];

interface Fixture {
  bron: string;
  invoer: CalculatieInvoer;
  verwacht: Record<string, number>;
}

describe.skipIf(bestanden.length === 0)("Excel-regressie", () => {
  for (const f of bestanden) {
    const fx: Fixture = JSON.parse(fs.readFileSync(path.join(dir!, f), "utf8"));
    it(`${fx.bron} geeft dezelfde uitkomst als Excel`, () => {
      const r = bereken(fx.invoer);
      for (const [veld, waarde] of Object.entries(fx.verwacht)) {
        expect(r[veld as keyof typeof r], veld).toBeCloseTo(waarde, 6);
      }
    });
  }
});
