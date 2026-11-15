-- FaceLens production schema fixes
-- Run once against an existing MySQL/TiDB database if these columns were created too small.
--
-- Symptoms:
--   Data truncation: Data too long for column 'result_json' at row 1
--
-- `result_json` stores the full AI report (including the detailed 3-photo analysis),
-- so it must be LONGTEXT. `doctor_questions.question` accepts up to 2000 characters.

ALTER TABLE analyses MODIFY result_json LONGTEXT NOT NULL;
ALTER TABLE doctor_questions MODIFY question TEXT NOT NULL;
