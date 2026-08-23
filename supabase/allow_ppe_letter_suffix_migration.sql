begin;

do $migration$
declare
  v_function regprocedure := 'public.issue_semi_expendable_property(uuid,uuid,uuid,boolean,text,text,text,text,text,text,text,text,text)'::regprocedure;
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef(v_function::oid) into v_definition;
  v_updated := replace(
    v_definition,
    'coalesce(trim(p_ppe_number), '''') !~ ''^\d{4}-\d{2}-\d{2}-\d{4}$''',
    'coalesce(trim(p_ppe_number), '''') !~* ''^\d{4}-\d{2}-\d{2}-(\d{4}|\d{3}[a-z])$'''
  );
  v_updated := replace(
    v_updated,
    'PPE No. must use YYYY-XX-XX-0001',
    'PPE No. must use YYYY-XX-XX-0001 or YYYY-XX-XX-001A'
  );
  if v_updated = v_definition then
    raise exception 'The current PPE validation rule was not found; migration was not applied';
  end if;
  execute v_updated;
end
$migration$;

commit;
