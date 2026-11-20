-- =============================================================================
-- seed_4000_scholars.sql
-- Seeds 4,000 City Scholars in PostgreSQL across the 11 Cagayan de Oro Schools:
--   - 1,500 First Year  (1st Year, Batch 2026)
--   - 1,200 Second Year (2nd Year, Batch 2025)
--   -   800 Third Year  (3rd Year, Batch 2024)
--   -   500 Fourth Year (4th Year, Batch 2023)
--   Total = 4,000 Scholars (2,000 Academic [<= 2.00 GWA] + 2,000 Non-Academic [<= 3.00 GWA])
-- =============================================================================

ALTER TABLE scholars ADD COLUMN IF NOT EXISTS applicant_rank INT NOT NULL DEFAULT 1;

DO $$
DECLARE
    current_total INT;
    need_y1 INT;
    need_y2 INT;
    need_y3 INT;
    need_y4 INT;
    schools TEXT[] := ARRAY[
        'Xavier University – Ateneo de Cagayan',
        'University of Science and Technology of Southern Philippines (USTP)',
        'Liceo de Cagayan University',
        'Capitol University',
        'PHINMA Cagayan de Oro College (COC)',
        'Lourdes College',
        'City College of Cagayan de Oro',
        'STI College Cagayan de Oro',
        'Pilgrim Christian College',
        'Southern de Oro Philippines College (SPC)',
        'AMA Computer College & ACLC College'
    ];
    programs TEXT[] := ARRAY[
        'BS in Nursing', 'BS Accountancy', 'BS Business Administration', 'BS Civil Engineering', 'BS Computer Science', 'Bachelor of Secondary Education',
        'BS Information Technology', 'BS Computer Engineering', 'BS Civil Engineering', 'BS Electrical Engineering', 'BS Mechanical Engineering', 'BS Applied Mathematics',
        'BS in Nursing', 'BS Medical Technology', 'BS Pharmacy', 'BS Business Administration', 'BS Hospitality Management', 'BS Criminology',
        'BS Marine Transportation', 'BS Marine Engineering', 'BS in Nursing', 'BS Criminology', 'BS Accountancy', 'Bachelor of Elementary Education',
        'BS Criminology', 'BS Accountancy', 'BS Tourism Management', 'BS in Nursing', 'BS Civil Engineering', 'BS Information Technology',
        'BS in Nursing', 'BS Nutrition and Dietetics', 'BS Pharmacy', 'BS Hospitality Management', 'BS Social Work', 'BS Psychology',
        'Bachelor of Technical-Vocational Teacher Education (BTVTEd)', 'Bachelor of Technology and Livelihood Education (BTLEd)', 'BS Office Administration', 'BS Entrepreneurship', 'AB Communication', 'AB Social Science',
        'BS Information Technology', 'BS Business Administration', 'BS Hospitality Management', 'BS Tourism Management', 'BS Information Technology', 'BS Tourism Management',
        'Bachelor of Elementary Education', 'Bachelor of Secondary Education', 'BS Business Administration', 'AB Liberal Arts', 'Bachelor of Secondary Education', 'BS Business Administration',
        'BS Criminology', 'BS Business Administration', 'Bachelor of Secondary Education', 'Bachelor of Elementary Education', 'BS Criminology', 'BS Business Administration',
        'BS Information Technology', 'BS Computer Science', 'BS Information Systems', 'BS Business Administration', 'BS Information Technology', 'BS Computer Science'
    ];
    fnames TEXT[] := ARRAY['Juan','Maria','Angelo','Bea','Carlo','Diana','Elijah','Faith','Gabriel','Hannah','Ivan','Jasmine','Kevin','Lara','Marco','Nadine','Oscar','Patricia','Samuel','Trisha','Adrian','Bianca','Christian','Denise','Edward','Frances','Gerald','Hazel','Ian','Jillian'];
    lnames TEXT[] := ARRAY['Dela Cruz','Santos','Reyes','Bautista','Ocampo','Garcia','Mendoza','Torres','Castillo','Villanueva','Ramos','Castro','Rivera','Aquino','Navarro','Salazar','Mercado','Soriano','Lumactod','Cabrera'];
BEGIN
    SELECT COUNT(*) INTO current_total FROM scholars;
    IF current_total < 4000 THEN
        -- Update existing scholars to CDO schools if they still say 'City University'
        UPDATE scholars
        SET school = schools[( hashtext(scholar_id) & 2147483647 ) % 11 + 1]
        WHERE school = 'City University' OR school IS NULL;

        SELECT GREATEST(0, 1500 - COUNT(*)) INTO need_y1 FROM scholars WHERE year_level = '1st Year';
        SELECT GREATEST(0, 1200 - COUNT(*)) INTO need_y2 FROM scholars WHERE year_level = '2nd Year';
        SELECT GREATEST(0, 800  - COUNT(*)) INTO need_y3 FROM scholars WHERE year_level = '3rd Year';
        SELECT GREATEST(0, 500  - COUNT(*)) INTO need_y4 FROM scholars WHERE year_level = '4th Year';

        -- Remove legacy 3-digit duplicate IDs so all 4,000 IDs are strictly YYYY-0000
        DELETE FROM scholars WHERE scholar_id !~ '^\d{4}-\d{4}$';

        -- Insert generated user accounts first (3NF FK requirement: scholars.scholar_id -> users.username)
        WITH generated AS (
            SELECT '2026-' || LPAD(g::TEXT, 4, '0') AS sid FROM generate_series(1, 1500) g
            UNION ALL
            SELECT '2025-' || LPAD(g::TEXT, 4, '0') AS sid FROM generate_series(1, 1200) g
            UNION ALL
            SELECT '2024-' || LPAD(g::TEXT, 4, '0') AS sid FROM generate_series(1, 800) g
            UNION ALL
            SELECT '2023-' || LPAD(g::TEXT, 4, '0') AS sid FROM generate_series(1, 500) g
        )
        INSERT INTO users (username, password_hash, role)
        SELECT sid, '123456', 'student' FROM generated
        ON CONFLICT (username) DO NOTHING;

        -- Insert generated scholars with CDO Schools & aligned Programs (exact 1,500 + 1,200 + 800 + 500 = 4,000)
        WITH generated AS (
            SELECT '2026-' || LPAD(g::TEXT, 4, '0') AS sid, '1st Year' AS ylevel, g AS seq, 750 AS acad_limit, (g % 11) + 1 AS s_idx FROM generate_series(1, 1500) g
            UNION ALL
            SELECT '2025-' || LPAD(g::TEXT, 4, '0') AS sid, '2nd Year' AS ylevel, g AS seq, 600 AS acad_limit, ((g + 3) % 11) + 1 AS s_idx FROM generate_series(1, 1200) g
            UNION ALL
            SELECT '2024-' || LPAD(g::TEXT, 4, '0') AS sid, '3rd Year' AS ylevel, g AS seq, 400 AS acad_limit, ((g + 6) % 11) + 1 AS s_idx FROM generate_series(1, 800) g
            UNION ALL
            SELECT '2023-' || LPAD(g::TEXT, 4, '0') AS sid, '4th Year' AS ylevel, g AS seq, 250 AS acad_limit, ((g + 9) % 11) + 1 AS s_idx FROM generate_series(1, 500) g
        )
        INSERT INTO scholars (scholar_id, name, email, contact_number, barangay_id, school, course, year_level, applicant_rank, status)
        SELECT
            sid,
            fnames[(seq % 30) + 1] || ' ' || lnames[((seq / 3) % 20) + 1],
            LOWER(sid) || '@cdo-scholar.edu.ph',
            '0917-' || LPAD(((100 + (seq % 899)))::TEXT, 3, '0') || '-' || LPAD(((1000 + (seq % 8999)))::TEXT, 4, '0'),
            ((seq % 35) + 1),
            schools[s_idx],
            programs[(s_idx - 1) * 6 + ((seq % 6) + 1)],
            ylevel,
            CASE WHEN seq <= acad_limit THEN ((seq - 1) % 1000) + 1 ELSE 1001 + ((seq - 1) % 1000) END,
            'active'
        FROM generated
        ON CONFLICT (scholar_id) DO NOTHING;
    END IF;
END $$;
