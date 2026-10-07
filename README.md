# Metaal-app

Opname, calculatie, offerte en order voor metaalbedrijven. Multi-tenant: elk bedrijf ziet alleen zijn eigen gegevens.

Plan en keuzes: zie het projectdocument "Haalbaarheid bedrijfsautomatisering".

## Stack

- Next.js (App Router, TypeScript) als web-app/PWA
- Supabase (PostgreSQL in EU, login, row-level security per bedrijf)
- Rekenkern in `src/lib/calc`: vaste formules, decimale rekenkunde, geen AI

## Starten

```bash
npm install
cp .env.example .env.local   # vul Supabase-URL en publishable key in
npm run dev
```

## Controles

| Commando | Wat |
| --- | --- |
| `npm test` | Unit-tests rekenkern |
| `PRIVATE_FIXTURES_DIR=<map> npm test` | Plus regressie tegen echte calculatiebladen (niet in de repo) |
| `DATABASE_URL=<lege db> ./scripts/test-db.sh` | Migraties + RLS-tests (bedrijfsscheiding, rechten, auditlog) |
| `npm run lint && npm run typecheck && npm run build` | Codekwaliteit en build |

Calculatiebladen omzetten naar testgevallen:

```bash
python3 -I scripts/excel_naar_fixture.py blad.xlsx <buiten-de-repo>/blad.json
```

Zet nooit klantbestanden, prijzen of projectnamen in deze repo.

## Database

Migraties staan in `supabase/migrations` en worden in volgorde toegepast. Kernregels:

- Elke tabel met bedrijfsdata heeft RLS; toegang via lidmaatschap (`leden`) en rol.
- Tarieven worden nooit gewijzigd of verwijderd; een nieuw bedrag is een nieuwe rij met `geldig_vanaf`.
- Elke wijziging komt via een trigger in `audit_log`.
- Externe acties (Exact, Outlook, Dropbox) lopen via `taken` met een unieke idempotentiesleutel.
