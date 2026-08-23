-- Add editable yearly PAR numbering for Capital Outlay and standardize unit conditions.
-- PAR format: YYYY-0001. A letter suffix is allowed, for example YYYY-001A.

alter table public.property_units
  add column if not exists par_number text,
  add column if not exists par_year integer,
  add column if not exists par_sequence integer;

update public.property_units
set condition = case
  when condition = 'Unserviceable' then 'Unserviceable'
  when condition in ('Repair', 'Under Repair') then 'Repair'
  else 'Serviceable'
end;

alter table public.property_units
  alter column condition set default 'Serviceable';

alter table public.property_units
  drop constraint if exists property_units_condition_check;

alter table public.property_units
  add constraint property_units_condition_check
  check (condition in ('Serviceable', 'Unserviceable', 'Repair'));

alter table public.property_units
  drop constraint if exists property_units_par_number_format_check;

alter table public.property_units
  add constraint property_units_par_number_format_check
  check (
    classification <> 'Capital Outlay'
    or par_number is null
    or par_number ~ '^[0-9]{4}-([0-9]{4}|[0-9]{3}[A-Za-z])$'
  );

create unique index if not exists property_units_par_number_key
  on public.property_units (upper(par_number))
  where par_number is not null;

create or replace function public.sync_property_par_parts()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.classification = 'Capital Outlay' and new.par_number is not null then
    new.par_number := upper(trim(new.par_number));
    new.par_year := split_part(new.par_number, '-', 1)::integer;
    new.par_sequence := substring(split_part(new.par_number, '-', 2) from '^[0-9]+')::integer;
  else
    new.par_year := null;
    new.par_sequence := null;
  end if;
  return new;
end;
$$;

drop trigger if exists property_units_sync_par_parts on public.property_units;
create trigger property_units_sync_par_parts
before insert or update of par_number, classification on public.property_units
for each row execute function public.sync_property_par_parts();

-- Migrate PAR numbers saved by compatibility mode before this column existed.
update public.property_units
set par_number = upper(substring(remarks from '\[PAR No\.:\s*([^\]]+)\]'))
where classification = 'Capital Outlay'
  and par_number is null
  and remarks ~* '\[PAR No\.:\s*[0-9]{4}-([0-9]{4}|[0-9]{3}[A-Za-z])\]';
