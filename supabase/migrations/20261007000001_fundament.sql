-- Fundament: bedrijven (tenants), leden met rollen, auditlog, wachtrij voor externe acties,
-- tarieven met geldigheidsdatum. Elke tabel met bedrijfsdata heeft row-level security.

create type public.rol as enum ('beheerder', 'sales', 'calculator', 'werkplaats', 'administratie');

create table public.bedrijven (
  id uuid primary key default gen_random_uuid(),
  naam text not null check (length(trim(naam)) > 0),
  created_at timestamptz not null default now()
);

create table public.leden (
  bedrijf_id uuid not null references public.bedrijven (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rol public.rol not null,
  created_at timestamptz not null default now(),
  primary key (bedrijf_id, user_id)
);
create index leden_user_idx on public.leden (user_id);

-- Hulpfuncties voor policies. security definer zodat ze leden kunnen lezen zonder recursie in RLS.
create function public.is_lid(p_bedrijf uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.leden l where l.bedrijf_id = p_bedrijf and l.user_id = (select auth.uid())
  );
$$;

create function public.heeft_rol(p_bedrijf uuid, p_rollen public.rol[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.leden l
    where l.bedrijf_id = p_bedrijf and l.user_id = (select auth.uid()) and l.rol = any (p_rollen)
  );
$$;

-- Nieuw bedrijf aanmaken: de aanmaker wordt beheerder.
create function public.maak_bedrijf(p_naam text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'niet ingelogd';
  end if;
  insert into public.bedrijven (naam) values (p_naam) returning id into v_id;
  insert into public.leden (bedrijf_id, user_id, rol) values (v_id, (select auth.uid()), 'beheerder');
  return v_id;
end;
$$;

-- Auditlog: wie wijzigde wat, wanneer, oud en nieuw. Alleen via trigger te vullen.
create table public.audit_log (
  id bigint generated always as identity primary key,
  bedrijf_id uuid references public.bedrijven (id) on delete cascade,
  tabel text not null,
  record_id text,
  actie text not null check (actie in ('INSERT', 'UPDATE', 'DELETE')),
  oud jsonb,
  nieuw jsonb,
  user_id uuid default auth.uid(),
  tijdstip timestamptz not null default now()
);
create index audit_log_bedrijf_idx on public.audit_log (bedrijf_id, tijdstip desc);

create function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_rij jsonb := coalesce(to_jsonb(new), to_jsonb(old));
begin
  insert into public.audit_log (bedrijf_id, tabel, record_id, actie, oud, nieuw)
  values (
    coalesce((v_rij ->> 'bedrijf_id')::uuid, case when tg_table_name = 'bedrijven' then (v_rij ->> 'id')::uuid end),
    tg_table_name,
    coalesce(v_rij ->> 'id', v_rij ->> 'user_id'),
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- Tarieven: nooit overschrijven, altijd een nieuwe rij met geldig_vanaf. Zo blijft elke
-- calculatie herleidbaar naar het tarief dat op dat moment gold.
create table public.tarieven (
  id uuid primary key default gen_random_uuid(),
  bedrijf_id uuid not null references public.bedrijven (id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  omschrijving text not null,
  eenheid text not null check (eenheid in ('uur', 'kg', 'km', 'stuk', 'dag', 'm', 'm2', 'pct')),
  bedrag numeric(12, 4) not null check (bedrag >= 0),
  geldig_vanaf date not null default current_date,
  bron text,
  aangemaakt_door uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  unique (bedrijf_id, code, geldig_vanaf)
);

create view public.actuele_tarieven with (security_invoker = true) as
select distinct on (bedrijf_id, code) *
from public.tarieven
where geldig_vanaf <= current_date
order by bedrijf_id, code, geldig_vanaf desc;

-- Wachtrij voor externe acties (Exact, Outlook, Dropbox): idempotent en opnieuw te proberen.
create type public.taak_status as enum ('wachtend', 'bezig', 'gelukt', 'mislukt');

create table public.taken (
  id uuid primary key default gen_random_uuid(),
  bedrijf_id uuid not null references public.bedrijven (id) on delete cascade,
  soort text not null,
  idempotentie_sleutel text not null,
  payload jsonb not null default '{}',
  status public.taak_status not null default 'wachtend',
  pogingen int not null default 0,
  volgende_poging timestamptz not null default now(),
  laatste_fout text,
  resultaat jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bedrijf_id, idempotentie_sleutel)
);
create index taken_te_doen_idx on public.taken (volgende_poging) where status = 'wachtend';

-- Triggers
create trigger audit_bedrijven after insert or update or delete on public.bedrijven
  for each row execute function public.audit_trigger();
create trigger audit_leden after insert or update or delete on public.leden
  for each row execute function public.audit_trigger();
create trigger audit_tarieven after insert or update or delete on public.tarieven
  for each row execute function public.audit_trigger();
create trigger audit_taken after insert or update on public.taken
  for each row execute function public.audit_trigger();

-- Row-level security
alter table public.bedrijven enable row level security;
alter table public.leden enable row level security;
alter table public.audit_log enable row level security;
alter table public.tarieven enable row level security;
alter table public.taken enable row level security;

create policy "leden zien hun bedrijf" on public.bedrijven
  for select to authenticated using (public.is_lid(id));
create policy "beheerder wijzigt bedrijf" on public.bedrijven
  for update to authenticated using (public.heeft_rol(id, '{beheerder}')) with check (public.heeft_rol(id, '{beheerder}'));

create policy "leden zien collega's" on public.leden
  for select to authenticated using (public.is_lid(bedrijf_id));
create policy "beheerder voegt leden toe" on public.leden
  for insert to authenticated with check (public.heeft_rol(bedrijf_id, '{beheerder}'));
create policy "beheerder wijzigt rollen" on public.leden
  for update to authenticated using (public.heeft_rol(bedrijf_id, '{beheerder}')) with check (public.heeft_rol(bedrijf_id, '{beheerder}'));
create policy "beheerder verwijdert leden" on public.leden
  for delete to authenticated using (public.heeft_rol(bedrijf_id, '{beheerder}') and user_id <> (select auth.uid()));

create policy "beheerder leest auditlog" on public.audit_log
  for select to authenticated using (public.heeft_rol(bedrijf_id, '{beheerder}'));

create policy "leden zien tarieven" on public.tarieven
  for select to authenticated using (public.is_lid(bedrijf_id));
create policy "beheerder en calculator voegen tarieven toe" on public.tarieven
  for insert to authenticated with check (public.heeft_rol(bedrijf_id, '{beheerder,calculator}'));
-- Geen update/delete-policy: tarieven zijn onveranderlijk.

-- taken: geen policies, alleen de server (service role) verwerkt de wachtrij.

revoke all on function public.audit_trigger() from public, anon, authenticated;
revoke all on function public.maak_bedrijf(text) from public, anon;
grant execute on function public.maak_bedrijf(text) to authenticated;
