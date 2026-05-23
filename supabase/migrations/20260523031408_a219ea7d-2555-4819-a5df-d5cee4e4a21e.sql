
SELECT cron.unschedule('morning-heartbeat-6am-pt') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'morning-heartbeat-6am-pt');
SELECT cron.unschedule('evening-heartbeat-9pm-pt') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evening-heartbeat-9pm-pt');

SELECT cron.schedule(
  'morning-heartbeat-6am-pt',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/scheduled-heartbeat',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM"}'::jsonb,
    body := '{"kind":"morning"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

SELECT cron.schedule(
  'evening-heartbeat-9pm-pt',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/scheduled-heartbeat',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM"}'::jsonb,
    body := '{"kind":"evening"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
