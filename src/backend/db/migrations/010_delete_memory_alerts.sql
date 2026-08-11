-- =====================================================
-- 010 — Remove persisted memory_alert noise
-- =====================================================
-- memory_alert rows flooded the "أحداث النظام" box (tens of thousands of
-- rows logged every few seconds while heap usage stays above threshold).
-- Live memory monitoring now only streams via SSE (system_alert), so the
-- accumulated persisted rows are no longer needed and are purged here.
DELETE FROM activities WHERE action = 'memory_alert';
