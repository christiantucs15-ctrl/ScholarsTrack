-- ==============================================================================
-- SCHOLARSTRACK DATABASE SEED DATA (PostgreSQL)
-- ==============================================================================

-- 1. Insert 7 Clusters (Cluster A through G)
INSERT INTO clusters (id, name) VALUES
('A', 'Cluster A'),
('B', 'Cluster B'),
('C', 'Cluster C'),
('D', 'Cluster D'),
('E', 'Cluster E'),
('F', 'Cluster F'),
('G', 'Cluster G')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert 35 Barangays (5 per Cluster)
INSERT INTO barangays (name, cluster_id) VALUES
-- Cluster A
('Bugo', 'A'), ('Puerto', 'A'), ('Agusan', 'A'), ('Balubal', 'A'), ('Tablon', 'A'),
-- Cluster B
('Lumbia', 'B'), ('Canitoan', 'B'), ('Pagatpat', 'B'), ('San Simon', 'B'), ('Baikingon', 'B'),
-- Cluster C
('Dansolihon', 'C'), ('Tignapoloan', 'C'), ('Besigan', 'C'), ('Mambuaya', 'C'), ('Bayanga', 'C'),
-- Cluster D
('Indahag', 'D'), ('Balulang', 'D'), ('Macasandig', 'D'), ('Nazareth', 'D'), ('Camaman-an', 'D'),
-- Cluster E
('Bonbon', 'E'), ('Bayabas', 'E'), ('Kauswagan', 'E'), ('Bulua', 'E'), ('Iponan', 'E'),
-- Cluster F
('FS Catanico', 'F'), ('Gusa', 'F'), ('Lapasan', 'F'), ('Cugman', 'F'), ('Macabalan', 'F'),
-- Cluster G
('Carmen', 'G'), ('Patag', 'G'), ('Puntod', 'G'), ('Consolacion', 'G'), ('Unified Barangays', 'G')
ON CONFLICT (name) DO NOTHING;

-- 3. Default Admin & Scholar Accounts (Default Password: 123456)
INSERT INTO users (username, password_hash, role) VALUES
('admin', '123456', 'admin'),
('2025-001', '123456', 'student'),
('2025-002', '123456', 'student')
ON CONFLICT (username) DO NOTHING;

-- 4. Sample Scholars
INSERT INTO scholars (scholar_id, name, email, contact_number, barangay_id, school, course, year_level, status) VALUES
('2025-001', 'Maria Santos', 'maria.santos@example.com', '0917-123-4567', (SELECT id FROM barangays WHERE name = 'Gusa'), 'City University', 'BS Information Technology', '2nd Year', 'active'),
('2025-002', 'John Reyes', 'john.reyes@example.com', '0918-234-5678', (SELECT id FROM barangays WHERE name = 'Bugo'), 'City State College', 'BS Accountancy', '3rd Year', 'active')
ON CONFLICT (scholar_id) DO NOTHING;

-- 5. Sample SDP Activities
INSERT INTO sdp_activities (title, category, target_date, cluster_id, expected_hours, expected_scholars, status) VALUES
('Academic Support & Peer Tutoring', 'Academic Support', '2026-08-15', NULL, 8, 35, 'completed'),
('Leadership & Civic Responsibility Training', 'Leadership Training', '2026-08-30', NULL, 8, 35, 'completed'),
('Scholars General Orientation', 'Seminar', '2026-09-10', NULL, 4, 35, 'completed'),
('Barangay Clean-up & Tree Planting Activity', 'Community Service', '2026-10-30', 'A', 8, 20, 'in_progress'),
('Financial Literacy & Career Webinar', 'Seminar', '2026-11-15', NULL, 4, 35, 'upcoming');
