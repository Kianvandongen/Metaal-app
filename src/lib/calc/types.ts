/**
 * Invoer- en uitvoertypes van de calculatie-engine (metaal).
 * Alle bedragen excl. btw, in euro. Maten in mm, gewichten in kg, tijden in uren.
 */

export const BEWERKINGEN = [
  "zagen",
  "boren",
  "lassen",
  "walsen",
  "knippen_buigen_snijden",
  "tekeningen",
  "werkvoorbereiding",
] as const;

export type Bewerking = (typeof BEWERKINGEN)[number];

/** Een waarde die bewust met de hand is ingevuld in plaats van berekend. */
export interface Handmatig {
  waarde: number;
  reden: string;
}

export interface Positie {
  nr: number;
  benaming: string;
  materiaal?: string;
  aantal: number;
  lengteMm?: number;
  kgPerM?: number;
  /** Vervangt aantal x lengte x kg/m, bv. een plaat op gewicht. */
  gewichtHandmatig?: Handmatig;
  /** Aantal handelingen waarover de uren per stuk worden vermenigvuldigd. */
  handelingen: number;
  uurPerStuk: Partial<Record<Bewerking, number>>;
  /** Vervangt handelingen x uur per stuk voor die bewerking. */
  urenHandmatig?: Partial<Record<Bewerking, Handmatig>>;
}

export interface InkoopRegel {
  omschrijving: string;
  /** "stuk": aantal x prijs. "totaal_kg": totaal gewicht van alle posities x prijs per kg. */
  basis: "stuk" | "totaal_kg";
  aantal: number;
  prijs: number;
  /** Opslag op uitbesteed werk of inkoop, in procenten. */
  opslagPct?: number;
  bedragHandmatig?: Handmatig;
}

export interface MontageRegel {
  omschrijving: string;
  aantal: number;
  tijd: number;
  tarief: number;
  /** true = telt per monteur (arbeid). false = telt één keer (bus, aanhanger). */
  perMonteur: boolean;
}

export interface CalculatieInvoer {
  posities: Positie[];
  /** Euro per kg materiaal. */
  kgPrijs: number;
  zaagverliesPct: number;
  tarieven: Record<Bewerking, number>;
  inkoop: InkoopRegel[];
  montage: MontageRegel[];
  aantalMonteurs: number;
  hulpmal: { uren: number; tarief: number };
  margePct: number;
}

export type Ernst = "fout" | "waarschuwing";

export interface Melding {
  ernst: Ernst;
  code: string;
  bericht: string;
  positie?: number;
}

/** Herleidbare rekenstap: wat is gebruikt, welke formule, welke uitkomst. */
export interface Rekenstap {
  onderdeel: string;
  omschrijving: string;
  formule: string;
  uitkomst: number;
  handmatig?: string;
}

export interface CalculatieResultaat {
  totaalKg: number;
  materiaal: number;
  bewerkingen: number;
  urenPerBewerking: Record<Bewerking, number>;
  inkoop: number;
  montage: number;
  hulpmal: number;
  kostprijs: number;
  marge: number;
  verkoopprijs: number;
  stappen: Rekenstap[];
  meldingen: Melding[];
  /** false zodra er een melding met ernst "fout" is: dan geen definitieve calculatie. */
  definitiefToegestaan: boolean;
}
