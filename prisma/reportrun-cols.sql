\pset format unaligned
\pset tuples_only on
\pset fieldsep '	'
SELECT column_name, data_type, character_maximum_length, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='ReportRun'
ORDER BY ordinal_position;
