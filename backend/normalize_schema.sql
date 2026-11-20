-- =============================================================================
-- ScholarsTrack - Strict 3NF Normalization & Full Foreign Key Connection Script
-- 1. Separates users into 3 dedicated role tables:
--      - admins   (references users.username)
--      - staff    (references users.username - unified Staff & Evaluator table)
--      - scholars (references users.username - Student / Scholar table)
-- 2. Removes all redundant / derived columns (3NF):
--      - password_reset_requests.scholar_name (derived via JOIN scholars)
--      - sdp_activities.expected_scholars     (derived via COUNT of scholars in cluster_id)
--      - grades.remarks                       (derived from final_grade <= 3.00)
--      - sdp_completions.verified_by_admin    (replaced by FK verified_by -> admins.username)
-- 3. Connects all 13 tables via Foreign Keys with zero floating tables!
-- =============================================================================

-- 1. Ensure default accounts exist in 'users'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'admin', 'evaluator', 'staff'));

INSERT INTO users (username, password_hash, role)
VALUES
    ('admin', '123456', 'admin'),
    ('staff', '123456', 'evaluator'),
    ('evaluator', '123456', 'evaluator')
ON CONFLICT (username) DO NOTHING;

-- 2. Create 'admins' table (dedicated Admin profile table)
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE REFERENCES users(username) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(120),
    office VARCHAR(100) DEFAULT 'City Scholarship Office',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admins (username, name, email, office)
VALUES ('admin', 'System Administrator', 'admin@cityscholar.edu', 'City Scholarship Office')
ON CONFLICT (username) DO NOTHING;

-- 3. Create 'staff' table (unified Staff / Evaluator table, replacing 'evaluators')
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE REFERENCES users(username) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(120),
    department VARCHAR(100) DEFAULT 'Scholarship Evaluation Office',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO staff (username, name, email, department)
VALUES
    ('staff', 'Evaluation Staff', 'staff@cityscholar.edu', 'Document Verification Unit'),
    ('evaluator', 'Scholarship Evaluator', 'evaluator@cityscholar.edu', 'Scholarship Evaluation Office')
ON CONFLICT (username) DO NOTHING;

-- Drop old 'evaluators' table so only 'admins', 'staff', and 'scholars' exist
ALTER TABLE renewals DROP CONSTRAINT IF EXISTS fk_renewals_evaluated_by;
DROP TABLE IF EXISTS evaluators CASCADE;

-- 4. 3NF on 'grades': drop derived 'remarks' column (computed from final_grade <= 3.00)
ALTER TABLE grades DROP COLUMN IF EXISTS remarks;

-- 5. Connect & Normalize 'notifications' -> 'scholars(scholar_id)' and 'admins(username)'
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_by VARCHAR(50) DEFAULT 'admin';
UPDATE notifications SET scholar_id = NULL WHERE scholar_id = '' OR scholar_id NOT IN (SELECT scholar_id FROM scholars);
UPDATE notifications SET created_by = 'admin' WHERE created_by IS NULL OR created_by NOT IN (SELECT username FROM admins);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_scholar;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_scholar
    FOREIGN KEY (scholar_id) REFERENCES scholars(scholar_id) ON DELETE CASCADE;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_created_by;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_created_by
    FOREIGN KEY (created_by) REFERENCES admins(username) ON DELETE SET NULL;

-- 6. 3NF Normalize & Connect 'password_reset_requests' -> 'scholars(scholar_id)' and 'admins(username)'
DELETE FROM password_reset_requests WHERE scholar_id NOT IN (SELECT scholar_id FROM scholars);
ALTER TABLE password_reset_requests DROP COLUMN IF EXISTS scholar_name;
ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(50);
UPDATE password_reset_requests SET resolved_by = 'admin' WHERE resolved_by IS NOT NULL AND resolved_by NOT IN (SELECT username FROM admins);

ALTER TABLE password_reset_requests DROP CONSTRAINT IF EXISTS fk_reset_requests_scholar;
ALTER TABLE password_reset_requests ADD CONSTRAINT fk_reset_requests_scholar
    FOREIGN KEY (scholar_id) REFERENCES scholars(scholar_id) ON DELETE CASCADE;

ALTER TABLE password_reset_requests DROP CONSTRAINT IF EXISTS fk_reset_requests_resolved_by;
ALTER TABLE password_reset_requests ADD CONSTRAINT fk_reset_requests_resolved_by
    FOREIGN KEY (resolved_by) REFERENCES admins(username) ON DELETE SET NULL;

-- 7. Connect 'system_settings' -> 'admins(username)' via 'updated_by'
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50) DEFAULT 'admin';
UPDATE system_settings SET updated_by = 'admin' WHERE updated_by IS NULL OR updated_by NOT IN (SELECT username FROM admins);

ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS fk_system_settings_updated_by;
ALTER TABLE system_settings ADD CONSTRAINT fk_system_settings_updated_by
    FOREIGN KEY (updated_by) REFERENCES admins(username) ON DELETE SET NULL;

-- 8. Connect 'renewals' & 'renewal_documents' -> 'staff(username)'
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS evaluated_by VARCHAR(50);
UPDATE renewals SET evaluated_by = 'staff' WHERE status IN ('approved', 'rejected') AND (evaluated_by IS NULL OR evaluated_by NOT IN (SELECT username FROM staff));

ALTER TABLE renewals DROP CONSTRAINT IF EXISTS fk_renewals_evaluated_by;
ALTER TABLE renewals ADD CONSTRAINT fk_renewals_evaluated_by
    FOREIGN KEY (evaluated_by) REFERENCES staff(username) ON DELETE SET NULL;

ALTER TABLE renewal_documents ADD COLUMN IF NOT EXISTS verified_by VARCHAR(50);
UPDATE renewal_documents SET verified_by = 'staff' WHERE status IN ('verified', 'rejected') AND (verified_by IS NULL OR verified_by NOT IN (SELECT username FROM staff));

ALTER TABLE renewal_documents DROP CONSTRAINT IF EXISTS fk_renewal_docs_verified_by;
ALTER TABLE renewal_documents ADD CONSTRAINT fk_renewal_docs_verified_by
    FOREIGN KEY (verified_by) REFERENCES staff(username) ON DELETE SET NULL;

-- 9. 3NF on 'sdp_activities' & 'sdp_completions': drop derived 'expected_scholars' and connect to 'admins(username)'
ALTER TABLE sdp_activities DROP COLUMN IF EXISTS expected_scholars;
ALTER TABLE sdp_activities ADD COLUMN IF NOT EXISTS created_by VARCHAR(50) DEFAULT 'admin';
UPDATE sdp_activities SET created_by = 'admin' WHERE created_by IS NULL OR created_by NOT IN (SELECT username FROM admins);

ALTER TABLE sdp_activities DROP CONSTRAINT IF EXISTS fk_sdp_activities_created_by;
ALTER TABLE sdp_activities ADD CONSTRAINT fk_sdp_activities_created_by
    FOREIGN KEY (created_by) REFERENCES admins(username) ON DELETE SET NULL;

ALTER TABLE sdp_completions DROP COLUMN IF EXISTS verified_by_admin;
ALTER TABLE sdp_completions ADD COLUMN IF NOT EXISTS time_in TIMESTAMP;
ALTER TABLE sdp_completions ADD COLUMN IF NOT EXISTS time_out TIMESTAMP;
ALTER TABLE sdp_completions ADD COLUMN IF NOT EXISTS verified_by VARCHAR(50) DEFAULT 'staff';
UPDATE sdp_completions SET verified_by = 'staff' WHERE verified_by IS NULL OR verified_by NOT IN (SELECT username FROM staff);
UPDATE sdp_completions SET time_in = COALESCE(time_in, completed_at), time_out = COALESCE(time_out, completed_at) WHERE completed_at IS NOT NULL;

ALTER TABLE sdp_completions DROP CONSTRAINT IF EXISTS fk_sdp_completions_verified_by;
ALTER TABLE sdp_completions ADD CONSTRAINT fk_sdp_completions_verified_by
    FOREIGN KEY (verified_by) REFERENCES staff(username) ON DELETE SET NULL;
