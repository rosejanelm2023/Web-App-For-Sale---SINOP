begin;

alter table purchase_orders
  add column if not exists purpose text;

commit;
