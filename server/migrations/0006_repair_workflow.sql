-- A repair job now follows a guide step by step, records safety gear checked before starting,
-- keeps photos taken during the work, and a short diary (problems faced, parts used, time taken, result).
ALTER TABLE repair_job ADD COLUMN device_type TEXT;
ALTER TABLE repair_job ADD COLUMN guide_id TEXT;
ALTER TABLE repair_job ADD COLUMN gear_checked TEXT NOT NULL DEFAULT '[]';
ALTER TABLE repair_job ADD COLUMN steps_done TEXT NOT NULL DEFAULT '[]';
ALTER TABLE repair_job ADD COLUMN during_photos TEXT NOT NULL DEFAULT '[]';
ALTER TABLE repair_job ADD COLUMN diary TEXT NOT NULL DEFAULT '{}';
