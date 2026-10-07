-- Hulpfuncties voor RLS uit het publieke API-schema halen (niet via /rest/v1/rpc aan te roepen).
create schema if not exists privaat;
revoke all on schema privaat from public;
grant usage on schema privaat to authenticated;

alter function public.is_lid(uuid) set schema privaat;
alter function public.heeft_rol(uuid, public.rol[]) set schema privaat;

revoke all on function privaat.is_lid(uuid) from public, anon;
revoke all on function privaat.heeft_rol(uuid, public.rol[]) from public, anon;
grant execute on function privaat.is_lid(uuid) to authenticated;
grant execute on function privaat.heeft_rol(uuid, public.rol[]) to authenticated;

create index tarieven_aangemaakt_door_idx on public.tarieven (aangemaakt_door);
