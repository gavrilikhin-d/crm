SELECT
  CASE
    WHEN recurring_schedule_id IS NULL THEN 'one_off'
    ELSE 'recurring'
  END AS lesson_kind,
  COUNT(*) AS lessons
FROM analytics.lessons
GROUP BY 1
ORDER BY lessons DESC;
