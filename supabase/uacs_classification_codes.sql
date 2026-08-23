-- Adds the requested UACS/PPE fields and loads the official master records.
-- Safe to run more than once: matching UACS Object Codes are updated.

alter table public.uacs_accounts
  add column if not exists ppe_sub_major text,
  add column if not exists gl_account text;

insert into public.uacs_accounts
  (uacs_code, account_title, account_category, ppe_sub_major, gl_account, active)
values
  ('1040501000', 'Semi-Expendable Machinery', 'Semi-Expendable', '05', '01', true),
  ('1040502000', 'Semi-Expendable Office Equipment', 'Semi-Expendable', '05', '02', true),
  ('1040503000', 'Semi-Expendable Information and Communications Technology Equipment ICT', 'Semi-Expendable', '05', '03', true),
  ('1040507000', 'Semi-Expendable Communications Equipment', 'Semi-Expendable', '05', '07', true),
  ('1040510000', 'Semi-Expendable Medical Equipment', 'Semi-Expendable', '51', '10', true),
  ('1040512000', 'Semi-Expendable Sports Equipment', 'Semi-Expendable', '51', '12', true),
  ('1040513000', 'Semi-Expendable Technical and Scientific Equipment', 'Semi-Expendable', '51', '13', true),
  ('1040519000', 'Semi-Expendable Other Machinery and Equipment', 'Semi-Expendable', '51', '19', true),
  ('1040601000', 'Semi-Expendable Furniture and Fixtures', 'Semi-Expendable', '60', '01', true),
  ('1040602000', 'Semi-Expendable Books', 'Semi-Expendable', '60', '02', true),
  ('1060101000', 'Land', 'Capital Outlay', '01', '01', true),
  ('1060401000', 'Buildings', 'Capital Outlay', '04', '01', true),
  ('1060501000', 'Machinery', 'Capital Outlay', '05', '01', true),
  ('1060502000', 'Office Equipment', 'Capital Outlay', '05', '02', true),
  ('1060503000', 'Information and Communications Technology Equipment', 'Capital Outlay', '05', '03', true),
  ('1060514000', 'Technical and Scientific Equipment', 'Capital Outlay', '05', '14', true),
  ('1060513000', 'Sports Equipment', 'Capital Outlay', '05', '13', true),
  ('1060511000', 'Medical Equipment', 'Capital Outlay', '05', '11', true),
  ('1060512000', 'Printing Equipment', 'Capital Outlay', '05', '12', true),
  ('1080102000', 'Computer Software', 'Capital Outlay', '01', '02', true),
  ('1060599000', 'Other Machinery and Equipment', 'Capital Outlay', '05', '99', true),
  ('1060601000', 'Motor Vehicles', 'Capital Outlay', '06', '01', true),
  ('1060701000', 'Furniture and Fixtures', 'Capital Outlay', '07', '01', true),
  ('1060702000', 'Books', 'Capital Outlay', '07', '02', true),
  ('1069899000', 'Other Property, Plant and Equipment', 'Capital Outlay', '98', '99', true)
on conflict (uacs_code) do update
set
  account_title = excluded.account_title,
  account_category = excluded.account_category,
  ppe_sub_major = excluded.ppe_sub_major,
  gl_account = excluded.gl_account,
  active = excluded.active,
  updated_at = now();
