SELECT plan, COUNT(*) AS teachers
FROM analytics.accounts
GROUP BY plan
ORDER BY teachers DESC;
