SELECT
  a.email,
  a.name,
  a.plan,
  a.created_at,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') AS active_students,
  COUNT(DISTINCT rs.id) AS recurring_schedules,
  COUNT(*) FILTER (WHERE l.recurring_schedule_id IS NULL) AS one_off_lessons,
  COUNT(*) FILTER (WHERE l.recurring_schedule_id IS NOT NULL) AS recurring_lessons,
  COALESCE(SUM(p.amount), 0) / 100.0 AS payments_total
FROM analytics.accounts a
LEFT JOIN analytics.students s ON s.account_id = a.id
LEFT JOIN analytics.recurring_schedules rs ON rs.account_id = a.id
LEFT JOIN analytics.lessons l ON l.account_id = a.id
LEFT JOIN analytics.payments p ON p.account_id = a.id
GROUP BY a.id, a.email, a.name, a.plan, a.created_at
ORDER BY a.created_at DESC;
