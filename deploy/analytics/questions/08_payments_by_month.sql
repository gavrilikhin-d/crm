SELECT date_trunc('month', paid_at::timestamptz) AS month, SUM(amount) / 100.0 AS payment_volume
FROM analytics.payments
GROUP BY 1
ORDER BY 1;
