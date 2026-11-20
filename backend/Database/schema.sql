-- ==============================================================================
-- SCHOLARSTRACK DATABASE SCHEMA (PostgreSQL)
-- Single exclusive city scholarship program with Cluster A to G & 35 Barangays
-- ==============================================================================

-- 1. CLUSTERS TABLE (7 Clusters: A to G)
CREATE TABLE IF NOT EXISTS clusters (
    id VARCHAR(5) PRIMARY KEY, -- 'A', 'B', 'C', 'D', 'E', 'F', 'G'
    name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. BARANGAYS TABLE (35 Barangays mapped to Clusters)
CREATE TABLE IF NOT EXISTS barangays (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    cluster_id VARCHAR(5) NOT NULL REFERENCES clusters(id) ON DELETE CASCADE
);

-- 3. USERS / ACCOUNTS TABLE
-- Admin and Scholar credentials. Scholar accounts are created exclusively by Admin.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL, -- Scholar ID (e.g. '2025-001') or Admin username
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. SCHOLARS TABLE
CREATE TABLE IF NOT EXISTS scholars (
    scholar_id VARCHAR(50) PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    contact_number VARCHAR(50),
    barangay_id INT NOT NULL REFERENCES barangays(id),
    school VARCHAR(150) DEFAULT 'City University / College',
    course VARCHAR(150) NOT NULL,
    year_level VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'probation', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. SEMESTER RENEWALS TABLE
CREATE TABLE IF NOT EXISTS renewals (
    id SERIAL PRIMARY KEY,
    scholar_id VARCHAR(50) NOT NULL REFERENCES scholars(scholar_id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL, -- e.g. '2026-2027'
    semester VARCHAR(20) NOT NULL,     -- e.g. '1st Semester'
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
    remarks TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    evaluated_at TIMESTAMP,
    UNIQUE(scholar_id, academic_year, semester)
);

-- 6. RENEWAL DOCUMENTS TABLE (4 mandatory requirements per period)
CREATE TABLE IF NOT EXISTS renewal_documents (
    id SERIAL PRIMARY KEY,
    renewal_id INT NOT NULL REFERENCES renewals(id) ON DELETE CASCADE,
    doc_type VARCHAR(100) NOT NULL CHECK (doc_type IN (
        'Latest Grades',
        'Certificate of Enrollment',
        'Accomplishment Report',
        'Parent Consent'
    )),
    file_path TEXT NOT NULL,
    file_size_kb INT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP
);

-- 7. SDP ACTIVITIES TABLE (Student Development Program)
CREATE TABLE IF NOT EXISTS sdp_activities (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN (
        'Community Service',
        'Leadership Training',
        'Seminar',
        'Academic Support'
    )),
    target_date DATE NOT NULL,
    cluster_id VARCHAR(5) REFERENCES clusters(id), -- NULL means 'All Clusters'
    expected_hours INT DEFAULT 4,
    expected_scholars INT DEFAULT 35,
    status VARCHAR(50) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. SDP COMPLETIONS TABLE (Records scholar attendance/credits)
CREATE TABLE IF NOT EXISTS sdp_completions (
    id SERIAL PRIMARY KEY,
    activity_id INT NOT NULL REFERENCES sdp_activities(id) ON DELETE CASCADE,
    scholar_id VARCHAR(50) NOT NULL REFERENCES scholars(scholar_id) ON DELETE CASCADE,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_by_admin BOOLEAN DEFAULT TRUE,
    UNIQUE(activity_id, scholar_id)
);

-- 9. GRADES TABLE (Stores subject grades per scholar and semester)
CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    scholar_id VARCHAR(50) NOT NULL REFERENCES scholars(scholar_id) ON DELETE CASCADE,
    period VARCHAR(50) NOT NULL,        -- e.g. '1st Semester, 2026-2027'
    course_code VARCHAR(30) NOT NULL,   -- e.g. 'IT 211'
    course_name VARCHAR(150) NOT NULL,  -- e.g. 'Database Systems 1'
    units INT NOT NULL DEFAULT 3,
    final_grade VARCHAR(10) NOT NULL,   -- e.g. '1.50'
    remarks VARCHAR(30) DEFAULT 'passed'
);

-- 10. NOTIFICATIONS TABLE (Stores alerts for both Admin and Scholars)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_role VARCHAR(20) NOT NULL CHECK (recipient_role IN ('student', 'admin')),
    scholar_id VARCHAR(50),             -- Optional: specific scholar recipient (NULL = all students/admin)
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. SYSTEM SETTINGS TABLE (Stores active academic year, semester, deadline, default password)
CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026-2027',
    semester VARCHAR(30) NOT NULL DEFAULT '1st Semester',
    renewal_open BOOLEAN NOT NULL DEFAULT TRUE,
    deadline DATE NOT NULL DEFAULT '2026-11-30',
    default_password VARCHAR(100) NOT NULL DEFAULT '123456'
);
