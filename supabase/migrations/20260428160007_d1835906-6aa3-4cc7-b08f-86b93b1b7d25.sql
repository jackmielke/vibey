DO $$
BEGIN
  PERFORM cron.unschedule('daily-recap-830am-pt');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'daily-recap-830am-pt',
  '30 15 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/daily-recap',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM"}'::jsonb,
    body := '{"automation_id":"97d8d7b3-610c-4419-bb1c-d6c53ee2b1e6"}'::jsonb
  ) AS request_id;
  $cron$
);
