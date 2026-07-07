SELECT date_trunc('month', created_at::timestamptz) AS month, COUNT(*) AS signups
FROM analytics.accounts
GROUP BY 1
ORDER BY 1;
