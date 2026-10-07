import { describe, expect, it } from "vitest";
import { bereken, rondAf } from "./engine";
import type { CalculatieInvoer } from "./types";

const tarieven = {
  zagen: 65,
  boren: 65,
  lassen: 65,
  walsen: 72.5,
  knippen_buigen_snijden: 89,
  tekeningen: 75,
  werkvoorbereiding: 72.5,
};

/** Fictief voorbeeld, opgebouwd zoals het calculatieblad. */
function voorbeeld(): CalculatieInvoer {
  return {
    posities: [
      {
        nr: 1,
        benaming: "Koker 40x40x3",
        materiaal: "S235",
        aantal: 4,
        lengteMm: 2500,
        kgPerM: 3.3,
        handelingen: 4,
        uurPerStuk: { zagen: 0.05, lassen: 0.25 },
      },
      {
        nr: 2,
        benaming: "Voetplaat 150x150x10",
        aantal: 4,
        lengteMm: 150,
        kgPerM: 12,
        handelingen: 4,
        uurPerStuk: { boren: 0.2 },
        urenHandmatig: { tekeningen: { waarde: 2, reden: "tekening door klant aangeleverd, alleen controle" } },
      },
    ],
    kgPrijs: 1.6,
    zaagverliesPct: 10,
    tarieven,
    inkoop: [
      { omschrijving: "Galvaniseren", basis: "totaal_kg", aantal: 0, prijs: 1.4 },
      { omschrijving: "Ankers", basis: "stuk", aantal: 16, prijs: 7.5 },
      { omschrijving: "Snijwerk extern", basis: "stuk", aantal: 1, prijs: 220, opslagPct: 10 },
    ],
    montage: [
      { omschrijving: "Montage", aantal: 1, tijd: 4, tarief: 67.5, perMonteur: true },
      { omschrijving: "Bus", aantal: 1, tijd: 50, tarief: 0.75, perMonteur: false },
    ],
    aantalMonteurs: 2,
    hulpmal: { uren: 1, tarief: 63 },
    margePct: 7.5,
  };
}

describe("bereken", () => {
  it("rekent alle onderdelen volgens het calculatieblad", () => {
    const r = bereken(voorbeeld());
    // 4 x 2,5 m x 3,3 = 33 kg; 4 x 0,15 m x 12 = 7,2 kg
    expect(r.totaalKg).toBeCloseTo(40.2, 10);
    expect(r.materiaal).toBeCloseTo(40.2 * 1.6 * 1.1, 10);
    // zagen 0,2 u, lassen 1 u, boren 0,8 u, tekeningen 2 u
    expect(r.urenPerBewerking).toMatchObject({ zagen: 0.2, lassen: 1, boren: 0.8, tekeningen: 2 });
    expect(r.bewerkingen).toBeCloseTo(0.2 * 65 + 1 * 65 + 0.8 * 65 + 2 * 75, 10);
    expect(r.inkoop).toBeCloseTo(40.2 * 1.4 + 16 * 7.5 + 242, 10);
    // arbeid x 2 monteurs, bus één keer
    expect(r.montage).toBeCloseTo(4 * 67.5 * 2 + 50 * 0.75, 10);
    expect(r.hulpmal).toBe(63);
    const kost = r.materiaal + r.bewerkingen + r.inkoop + r.montage + r.hulpmal;
    expect(r.kostprijs).toBeCloseTo(kost, 10);
    expect(r.verkoopprijs).toBeCloseTo(kost * 1.075, 10);
    expect(r.definitiefToegestaan).toBe(true);
  });

  it("rekent exact decimaal (geen floating-point drift)", () => {
    const r = bereken({ ...voorbeeld(), posities: [], inkoop: [], montage: [], hulpmal: { uren: 3, tarief: 0.1 }, margePct: 0 });
    expect(r.kostprijs).toBe(0.3);
  });

  it("legt elke handmatige waarde met reden vast in de rekenstappen", () => {
    const r = bereken(voorbeeld());
    const s = r.stappen.find((x) => x.handmatig);
    expect(s?.handmatig).toContain("tekening door klant");
  });

  it("blokkeert definitief bij handmatige waarde zonder reden", () => {
    const inv = voorbeeld();
    inv.posities[1].urenHandmatig = { tekeningen: { waarde: 2, reden: " " } };
    const r = bereken(inv);
    expect(r.meldingen.map((m) => m.code)).toContain("reden_ontbreekt");
    expect(r.definitiefToegestaan).toBe(false);
  });

  it("blokkeert definitief als kg/m ontbreekt bij een lengte", () => {
    const inv = voorbeeld();
    inv.posities[0].kgPerM = undefined;
    const r = bereken(inv);
    expect(r.meldingen.find((m) => m.code === "kg_per_m_ontbreekt")?.positie).toBe(1);
    expect(r.definitiefToegestaan).toBe(false);
  });

  it("waarschuwt als uren per stuk zijn ingevuld zonder aantal handelingen", () => {
    const inv = voorbeeld();
    inv.posities[0].handelingen = 0;
    const r = bereken(inv);
    expect(r.meldingen.find((m) => m.code === "uren_zonder_aantal")?.ernst).toBe("waarschuwing");
  });

  it("waarschuwt bij gewicht zonder kg-prijs", () => {
    const r = bereken({ ...voorbeeld(), kgPrijs: 0 });
    expect(r.meldingen.map((m) => m.code)).toContain("kg_prijs_nul");
  });

  it("rondt bedragen half naar boven af op centen", () => {
    expect(rondAf(2038.50675)).toBe("2038.51");
    expect(rondAf(0.005)).toBe("0.01");
  });
});
