-- LOCAL REVIEW ONLY. Apply only after the database target is classified and approved.
-- Existing numeric(9,6) branch columns round these owner-confirmed coordinates
-- to six decimal places (well below one metre of displacement).
do $$
begin
  if (select count(*) from public.branches
      where id in (
        'c1000000-0000-0000-0000-000000000001'::uuid,
        'c1000000-0000-0000-0000-000000000002'::uuid
      )) <> 2 then
    raise exception 'ATTENDANCE_GEOFENCE_BRANCH_MISSING';
  end if;
end $$;

update public.branches
set latitude = case id
      when 'c1000000-0000-0000-0000-000000000001'::uuid then 10.7024485
      when 'c1000000-0000-0000-0000-000000000002'::uuid then 10.671561584942413
    end,
    longitude = case id
      when 'c1000000-0000-0000-0000-000000000001'::uuid then 122.9619465
      when 'c1000000-0000-0000-0000-000000000002'::uuid then 122.94369105292084
    end
where id in (
  'c1000000-0000-0000-0000-000000000001'::uuid,
  'c1000000-0000-0000-0000-000000000002'::uuid
);
