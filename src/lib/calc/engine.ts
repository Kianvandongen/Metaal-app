import Decimal from "decimal.js";
import {
  BEWERKINGEN,
  type Bewerking,
  type CalculatieInvoer,
  type CalculatieResultaat,
  type Melding,
  type Rekenstap,
} from "./types";

const D = (n: number | undefined) => new Decimal(n ?? 0);
const fmt = (n: Decimal | number) => new Decimal(n).toDecimalPlaces(4).toString();

/**
 * Rekent een metaalcalculatie door volgens de vaste formules van het calculatieblad.
 * Puur: geen I/O, geen AI, geen afronding tussendoor (alleen in de presentatie).
 */
export function bereken(invoer: CalculatieInvoer): CalculatieResultaat {
  const stappen: Rekenstap[] = [];
  const meldingen: Melding[] = [];
  const stap = (s: Omit<Rekenstap, "uitkomst">, uitkomst: Decimal) => {
    stappen.push({ ...s, uitkomst: uitkomst.toNumber() });
    return uitkomst;
  };

  // Materiaal
  let totaalKg = new Decimal(0);
  for (const p of invoer.posities) {
    let kg: Decimal;
    if (p.gewichtHandmatig) {
      controleerReden(p.gewichtHandmatig.reden, meldingen, p.nr, "gewicht");
      kg = stap(
        {
          onderdeel: "materiaal",
          omschrijving: `Pos ${p.nr} ${p.benaming}`,
          formule: `handmatig ${fmt(p.gewichtHandmatig.waarde)} kg`,
          handmatig: p.gewichtHandmatig.reden,
        },
        D(p.gewichtHandmatig.waarde),
      );
    } else {
      if (p.lengteMm && p.aantal && !p.kgPerM) {
        meldingen.push({
          ernst: "fout",
          code: "kg_per_m_ontbreekt",
          bericht: `Pos ${p.nr} ${p.benaming}: kg/m ontbreekt.`,
          positie: p.nr,
        });
      }
      kg = D(p.aantal).mul(D(p.lengteMm)).div(1000).mul(D(p.kgPerM));
      if (!kg.isZero()) {
        stap(
          {
            onderdeel: "materiaal",
            omschrijving: `Pos ${p.nr} ${p.benaming}`,
            formule: `${fmt(p.aantal)} st x ${fmt(p.lengteMm ?? 0)} mm / 1000 x ${fmt(p.kgPerM ?? 0)} kg/m`,
          },
          kg,
        );
      }
    }
    totaalKg = totaalKg.add(kg);
  }
  if (totaalKg.gt(0) && invoer.kgPrijs === 0) {
    meldingen.push({
      ernst: "waarschuwing",
      code: "kg_prijs_nul",
      bericht: `Er is ${fmt(totaalKg)} kg materiaal maar de kg-prijs is 0.`,
    });
  }
  const materiaalNetto = totaalKg.mul(D(invoer.kgPrijs));
  const materiaal = stap(
    {
      onderdeel: "materiaal",
      omschrijving: "Materiaal incl. zaagverlies",
      formule: `${fmt(totaalKg)} kg x € ${fmt(invoer.kgPrijs)}/kg x (1 + ${fmt(invoer.zaagverliesPct)}%)`,
    },
    materiaalNetto.mul(D(invoer.zaagverliesPct).div(100).add(1)),
  );

  // Bewerkingen
  const uren = Object.fromEntries(BEWERKINGEN.map((b) => [b, new Decimal(0)])) as Record<
    Bewerking,
    Decimal
  >;
  for (const p of invoer.posities) {
    for (const b of BEWERKINGEN) {
      const hand = p.urenHandmatig?.[b];
      const perStuk = p.uurPerStuk[b] ?? 0;
      if (hand) {
        controleerReden(hand.reden, meldingen, p.nr, b);
        uren[b] = uren[b].add(D(hand.waarde));
        stap(
          {
            onderdeel: "bewerkingen",
            omschrijving: `Pos ${p.nr} ${b}`,
            formule: `handmatig ${fmt(hand.waarde)} u`,
            handmatig: hand.reden,
          },
          D(hand.waarde),
        );
        continue;
      }
      if (perStuk && !p.handelingen) {
        meldingen.push({
          ernst: "waarschuwing",
          code: "uren_zonder_aantal",
          bericht: `Pos ${p.nr} ${p.benaming}: ${fmt(perStuk)} u/st ${b} ingevuld maar aantal handelingen is 0; telt niet mee.`,
          positie: p.nr,
        });
      }
      const u = D(p.handelingen).mul(D(perStuk));
      if (!u.isZero()) {
        uren[b] = uren[b].add(u);
        stap(
          {
            onderdeel: "bewerkingen",
            omschrijving: `Pos ${p.nr} ${b}`,
            formule: `${fmt(p.handelingen)} x ${fmt(perStuk)} u/st`,
          },
          u,
        );
      }
    }
  }
  let bewerkingen = new Decimal(0);
  for (const b of BEWERKINGEN) {
    if (uren[b].isZero()) continue;
    bewerkingen = bewerkingen.add(
      stap(
        {
          onderdeel: "bewerkingen",
          omschrijving: `Totaal ${b}`,
          formule: `${fmt(uren[b])} u x € ${fmt(invoer.tarieven[b])}/u`,
        },
        uren[b].mul(D(invoer.tarieven[b])),
      ),
    );
  }

  // Inkoop en uitbesteed werk
  let inkoop = new Decimal(0);
  for (const r of invoer.inkoop) {
    if (r.bedragHandmatig) {
      controleerReden(r.bedragHandmatig.reden, meldingen, undefined, r.omschrijving);
      inkoop = inkoop.add(
        stap(
          {
            onderdeel: "inkoop",
            omschrijving: r.omschrijving,
            formule: `handmatig € ${fmt(r.bedragHandmatig.waarde)}`,
            handmatig: r.bedragHandmatig.reden,
          },
          D(r.bedragHandmatig.waarde),
        ),
      );
      continue;
    }
    const hoeveelheid = r.basis === "totaal_kg" ? totaalKg : D(r.aantal);
    const opslag = D(r.opslagPct).div(100).add(1);
    const bedrag = hoeveelheid.mul(D(r.prijs)).mul(opslag);
    if (bedrag.isZero()) continue;
    inkoop = inkoop.add(
      stap(
        {
          onderdeel: "inkoop",
          omschrijving: r.omschrijving,
          formule:
            `${fmt(hoeveelheid)} ${r.basis === "totaal_kg" ? "kg" : "x"} € ${fmt(r.prijs)}` +
            (r.opslagPct ? ` x (1 + ${fmt(r.opslagPct)}%)` : ""),
        },
        bedrag,
      ),
    );
  }

  // Montage
  if (invoer.montage.length && invoer.aantalMonteurs < 1) {
    meldingen.push({ ernst: "fout", code: "geen_monteurs", bericht: "Aantal monteurs is 0." });
  }
  let montage = new Decimal(0);
  for (const r of invoer.montage) {
    const factor = r.perMonteur ? D(invoer.aantalMonteurs) : new Decimal(1);
    const bedrag = D(r.aantal).mul(D(r.tijd)).mul(D(r.tarief)).mul(factor);
    if (bedrag.isZero()) continue;
    montage = montage.add(
      stap(
        {
          onderdeel: "montage",
          omschrijving: r.omschrijving,
          formule: `${fmt(r.aantal)} x ${fmt(r.tijd)} x € ${fmt(r.tarief)}${r.perMonteur ? ` x ${fmt(invoer.aantalMonteurs)} monteurs` : ""}`,
        },
        bedrag,
      ),
    );
  }

  const hulpmal = D(invoer.hulpmal.uren).mul(D(invoer.hulpmal.tarief));
  if (!hulpmal.isZero()) {
    stap(
      {
        onderdeel: "hulpmal",
        omschrijving: "Aanmaak hulpmal",
        formule: `${fmt(invoer.hulpmal.uren)} u x € ${fmt(invoer.hulpmal.tarief)}/u`,
      },
      hulpmal,
    );
  }

  const kostprijs = materiaal.add(bewerkingen).add(inkoop).add(montage).add(hulpmal);
  stap(
    {
      onderdeel: "totaal",
      omschrijving: "Kostprijs",
      formule: `materiaal ${fmt(materiaal)} + bewerkingen ${fmt(bewerkingen)} + inkoop ${fmt(inkoop)} + montage ${fmt(montage)} + hulpmal ${fmt(hulpmal)}`,
    },
    kostprijs,
  );
  if (invoer.margePct < 0) {
    meldingen.push({ ernst: "fout", code: "marge_negatief", bericht: "Marge is negatief." });
  }
  const marge = stap(
    { onderdeel: "totaal", omschrijving: "Marge", formule: `${fmt(kostprijs)} x ${fmt(invoer.margePct)}%` },
    kostprijs.mul(D(invoer.margePct)).div(100),
  );
  const verkoopprijs = stap(
    { onderdeel: "totaal", omschrijving: "Verkoopprijs excl. btw", formule: "kostprijs + marge" },
    kostprijs.add(marge),
  );

  return {
    totaalKg: totaalKg.toNumber(),
    materiaal: materiaal.toNumber(),
    bewerkingen: bewerkingen.toNumber(),
    urenPerBewerking: Object.fromEntries(
      BEWERKINGEN.map((b) => [b, uren[b].toNumber()]),
    ) as Record<Bewerking, number>,
    inkoop: inkoop.toNumber(),
    montage: montage.toNumber(),
    hulpmal: hulpmal.toNumber(),
    kostprijs: kostprijs.toNumber(),
    marge: marge.toNumber(),
    verkoopprijs: verkoopprijs.toNumber(),
    stappen,
    meldingen,
    definitiefToegestaan: !meldingen.some((m) => m.ernst === "fout"),
  };
}

function controleerReden(reden: string, meldingen: Melding[], positie: number | undefined, wat: string) {
  if (!reden.trim()) {
    meldingen.push({
      ernst: "fout",
      code: "reden_ontbreekt",
      bericht: `Handmatige waarde voor ${wat} zonder reden.`,
      positie,
    });
  }
}

/** Bedrag afronden voor weergave op offerte (half naar boven, 2 decimalen). */
export function rondAf(bedrag: number): string {
  return new Decimal(bedrag).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}
