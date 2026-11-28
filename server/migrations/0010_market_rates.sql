-- Nov 2026 pricing fix.
-- 1. Phone and tablet circuit boards get their own, higher rate (high grade: gold, palladium). IndiaMART listings, Nov 2026:
--    Rs 550-5,000 per kg, about 1,500 typical. Copied from each city's general board rate (x5), with the same history.
INSERT INTO rate (material, city, rate_per_kg, updated_at, source)
  SELECT 'pcb_mobile', city, ROUND(rate_per_kg * 5), updated_at, 'Market estimate: IndiaMART phone board listings, Nov 2026'
  FROM rate WHERE material = 'pcb'
  ON CONFLICT (material, city) DO NOTHING;
INSERT INTO rate_history (material, city, day, rate_per_kg)
  SELECT 'pcb_mobile', city, day, ROUND(rate_per_kg * 5) FROM rate_history WHERE material = 'pcb'
  ON CONFLICT (material, city, day) DO NOTHING;
-- 2. Li-ion battery scrap trades at Rs 250-350 per kg, not ~88. Raise only rates still at the old level (an auditor's edit is kept).
UPDATE rate SET rate_per_kg = ROUND(rate_per_kg * 250 / 88.0), source = 'Market estimate: IndiaMART battery scrap listings, Nov 2026'
  WHERE material = 'battery_li' AND rate_per_kg < 150;
UPDATE rate_history SET rate_per_kg = ROUND(rate_per_kg * 250 / 88.0) WHERE material = 'battery_li' AND rate_per_kg < 150;
