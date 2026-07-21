-- Read-only inspection of Supabase migration history.
select *
from supabase_migrations.schema_migrations
order by version;

select version, count(*) as history_rows
from supabase_migrations.schema_migrations
group by version
having count(*) > 1
order by version;
