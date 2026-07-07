SELECT COALESCE(SUM(amount), 0) / 100.0 AS payment_volume
FROM analytics.payments;
