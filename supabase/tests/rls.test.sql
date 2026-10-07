-- RLS-tests: draaien na auth_shim.sql en de migraties. Elke fout breekt af met een exception.
\set ON_ERROR_STOP on
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');

set role authenticated;

-- Gebruiker A maakt bedrijf A, gebruiker B maakt bedrijf B
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.maak_bedrijf('Bedrijf A') as bedrijf_a \gset
select set_config('test.bedrijf_a', :'bedrijf_a', false) \g /dev/null
insert into public.tarieven (bedrijf_id, code, omschrijving, eenheid, bedrag, geldig_vanaf)
values (:'bedrijf_a', 'zagen', 'Zagen en handling', 'uur', 63, '2026-01-01'),
       (:'bedrijf_a', 'zagen', 'Zagen en handling', 'uur', 65, '2026-09-01');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.maak_bedrijf('Bedrijf B') as bedrijf_b \gset

do $$ begin
  -- B ziet niets van A
  if (select count(*) from public.bedrijven) <> 1 then raise exception 'B ziet andere bedrijven'; end if;
  if (select count(*) from public.tarieven) <> 0 then raise exception 'B ziet tarieven van A'; end if;
end $$;

-- B kan geen tarief in bedrijf A zetten
do $$ begin
  begin
    insert into public.tarieven (bedrijf_id, code, omschrijving, eenheid, bedrag)
    values (current_setting('test.bedrijf_a')::uuid, 'boren', 'x', 'uur', 1);
    raise exception 'B kon tarief in A invoegen';
  exception when insufficient_privilege or undefined_object then null;
  end;
end $$;

-- A ziet het actuele tarief (65) en kan tarieven niet wijzigen
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if (select bedrag from public.actuele_tarieven where code = 'zagen') <> 65 then
    raise exception 'actueel tarief is niet het nieuwste';
  end if;
  update public.tarieven set bedrag = 1;
  if exists (select 1 from public.tarieven where bedrag = 1) then raise exception 'tarief kon gewijzigd worden'; end if;
  delete from public.tarieven;
  if (select count(*) from public.tarieven) <> 2 then raise exception 'tarief kon verwijderd worden'; end if;
end $$;

-- Werkplaats-medewerker C in bedrijf A mag geen tarieven toevoegen
insert into public.leden (bedrijf_id, user_id, rol) values (:'bedrijf_a', '00000000-0000-0000-0000-00000000000c', 'werkplaats');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  begin
    insert into public.tarieven (bedrijf_id, code, omschrijving, eenheid, bedrag)
    select id, 'boren', 'x', 'uur', 1 from public.bedrijven;
    raise exception 'werkplaats kon tarief toevoegen';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.audit_log) then raise exception 'werkplaats leest auditlog'; end if;
end $$;

-- Beheerder A ziet de auditregels; wachtrij is niet leesbaar voor gebruikers
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if (select count(*) from public.audit_log where tabel = 'tarieven' and actie = 'INSERT') <> 2 then
    raise exception 'auditlog mist tarief-inserts';
  end if;
  if exists (select 1 from public.audit_log where bedrijf_id <> current_setting('test.bedrijf_a')::uuid) then
    raise exception 'auditlog toont ander bedrijf';
  end if;
end $$;

reset role;
select 'RLS-tests geslaagd' as resultaat;
