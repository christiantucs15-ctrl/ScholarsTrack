using Npgsql;

// =============================================================================
// Program.cs - Entry point for the ScholarsTrack C# ASP.NET Core Web API
// Configures port 5000, CORS, Static File Uploads, and auto-initializes
// PostgreSQL tables on startup.
// =============================================================================

// 1. Ensure wwwroot/uploads exists BEFORE CreateBuilder so ASP.NET Core serves uploaded files
Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads"));

var builder = WebApplication.CreateBuilder(args);

// 2. Listen on 0.0.0.0:5000 so both localhost and network/proxied connections can reach the C# API
builder.WebHost.UseUrls("http://0.0.0.0:5000");

// 3. Register API Controllers
builder.Services.AddControllers();

// 4. Enable CORS for localhost, LAN IP addresses, and Port Forwarding tunnels
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactClient", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseStaticFiles();
app.UseCors("AllowReactClient");
app.MapControllers();

// 5. Connect to PostgreSQL on startup and ensure all required tables & default rows exist
var connString = app.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=5432;Database=scholarstrack;Username=postgres;Password=123456";

try
{
    await using var conn = new NpgsqlConnection(connString);
    await conn.OpenAsync();

    // Auto-create ALL base tables & normalized schema so a brand-new empty PostgreSQL
    // database works out-of-the-box without running any manual SQL files first!
    const string initTablesSql = @"
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL,
            username VARCHAR(50) PRIMARY KEY,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'student',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE users ADD COLUMN IF NOT EXISTS id SERIAL;

        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'admin', 'evaluator', 'staff'));

        CREATE TABLE IF NOT EXISTS clusters (
            id VARCHAR(10) PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE
        );

        INSERT INTO clusters (id, name) VALUES
            ('A', 'Cluster A'), ('B', 'Cluster B'), ('C', 'Cluster C'), ('D', 'Cluster D'),
            ('E', 'Cluster E'), ('F', 'Cluster F'), ('G', 'Cluster G')
        ON CONFLICT (id) DO NOTHING;

        CREATE TABLE IF NOT EXISTS barangays (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            cluster_id VARCHAR(10) NOT NULL REFERENCES clusters(id) ON DELETE CASCADE
        );

        INSERT INTO barangays (name, cluster_id) VALUES
            ('Bugo', 'A'), ('Puerto', 'A'), ('Agusan', 'A'), ('Balubal', 'A'), ('Tablon', 'A'),
            ('Lumbia', 'B'), ('Canitoan', 'B'), ('Pagatpat', 'B'), ('San Simon', 'B'), ('Baikingon', 'B'),
            ('Dansolihon', 'C'), ('Tignapoloan', 'C'), ('Besigan', 'C'), ('Mambuaya', 'C'), ('Bayanga', 'C'),
            ('Indahag', 'D'), ('Balulang', 'D'), ('Macasandig', 'D'), ('Nazareth', 'D'), ('Camaman-an', 'D'),
            ('Bonbon', 'E'), ('Bayabas', 'E'), ('Kauswagan', 'E'), ('Bulua', 'E'), ('Iponan', 'E'),
            ('FS Catanico', 'F'), ('Gusa', 'F'), ('Lapasan', 'F'), ('Cugman', 'F'), ('Macabalan', 'F'),
            ('Carmen', 'G'), ('Patag', 'G'), ('Puntod', 'G'), ('Consolacion', 'G'), ('Unified Barangays', 'G')
        ON CONFLICT (name) DO NOTHING;

        CREATE TABLE IF NOT EXISTS scholars (
            scholar_id VARCHAR(50) PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            email VARCHAR(120),
            contact_number VARCHAR(50),
            school VARCHAR(150) DEFAULT 'Xavier University – Ateneo de Cagayan',
            barangay_id INT NOT NULL REFERENCES barangays(id),
            course VARCHAR(150) DEFAULT 'BS Information Technology',
            year_level VARCHAR(20) DEFAULT '1st Year',
            applicant_rank INT NOT NULL DEFAULT 1,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS renewals (
            id SERIAL PRIMARY KEY,
            scholar_id VARCHAR(50) NOT NULL REFERENCES scholars(scholar_id) ON DELETE CASCADE,
            academic_year VARCHAR(20) NOT NULL,
            semester VARCHAR(30) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            remarks TEXT,
            evaluated_by VARCHAR(50),
            evaluated_at TIMESTAMP,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (scholar_id, academic_year, semester)
        );

        CREATE TABLE IF NOT EXISTS renewal_documents (
            id SERIAL PRIMARY KEY,
            renewal_id INT NOT NULL REFERENCES renewals(id) ON DELETE CASCADE,
            doc_type VARCHAR(100) NOT NULL,
            file_path VARCHAR(255) NOT NULL,
            file_size_kb INT DEFAULT 1024,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            verified_by VARCHAR(50),
            verified_at TIMESTAMP,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sdp_activities (
            id SERIAL PRIMARY KEY,
            title VARCHAR(150) NOT NULL,
            category VARCHAR(80) NOT NULL DEFAULT 'Community Service',
            target_date DATE NOT NULL,
            cluster_id VARCHAR(10) REFERENCES clusters(id) ON DELETE SET NULL,
            target_year_level VARCHAR(20) DEFAULT 'All Years',
            expected_hours INT NOT NULL DEFAULT 4,
            status VARCHAR(30) NOT NULL DEFAULT 'upcoming',
            created_by VARCHAR(50) DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sdp_completions (
            id SERIAL PRIMARY KEY,
            activity_id INT NOT NULL REFERENCES sdp_activities(id) ON DELETE CASCADE,
            scholar_id VARCHAR(50) NOT NULL REFERENCES scholars(scholar_id) ON DELETE CASCADE,
            time_in TIMESTAMP,
            time_out TIMESTAMP,
            completed_at TIMESTAMP,
            verified_by VARCHAR(50) DEFAULT 'staff',
            UNIQUE (activity_id, scholar_id)
        );

        INSERT INTO users (username, password_hash, role)
        VALUES
            ('admin', '123456', 'admin')
        ON CONFLICT (username) DO UPDATE SET password_hash = '123456', role = 'admin';

        INSERT INTO users (username, password_hash, role)
        VALUES
            ('evaluator', '123456', 'evaluator'),
            ('staff', '123456', 'evaluator')
        ON CONFLICT (username) DO UPDATE SET password_hash = '123456', role = 'evaluator';

        -- 1. 'admins' table (dedicated profile table for Admin accounts, linked to users)
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

        -- 2. 'staff' table (unified table for Staff / Evaluators, replacing 'evaluators')
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

        -- Drop legacy 'evaluators' table so only 'staff', 'admins', and 'scholars' exist
        ALTER TABLE renewals DROP CONSTRAINT IF EXISTS fk_renewals_evaluated_by;
        DROP TABLE IF EXISTS evaluators CASCADE;

        CREATE TABLE IF NOT EXISTS grades (
            id SERIAL PRIMARY KEY,
            scholar_id VARCHAR(50) NOT NULL REFERENCES scholars(scholar_id) ON DELETE CASCADE,
            period VARCHAR(50) NOT NULL,
            course_code VARCHAR(30) NOT NULL,
            course_name VARCHAR(150) NOT NULL,
            units INT NOT NULL DEFAULT 3,
            final_grade VARCHAR(10) NOT NULL
        );

        -- 3NF: Drop derived 'remarks' column from 'grades' (derived from final_grade <= 3.0)
        ALTER TABLE grades DROP COLUMN IF EXISTS remarks;

        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            recipient_role VARCHAR(20) NOT NULL,
            scholar_id VARCHAR(50) REFERENCES scholars(scholar_id) ON DELETE CASCADE,
            created_by VARCHAR(50) DEFAULT 'admin' REFERENCES admins(username) ON DELETE SET NULL,
            title VARCHAR(150) NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning')),
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_recipient_role_check;
        ALTER TABLE notifications ADD CONSTRAINT notifications_recipient_role_check CHECK (recipient_role IN ('student', 'admin', 'evaluator', 'staff'));

        -- Normalize and connect 'notifications' to 'scholars' and 'admins'
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_by VARCHAR(50) DEFAULT 'admin';
        UPDATE notifications SET scholar_id = NULL WHERE scholar_id = '' OR scholar_id NOT IN (SELECT scholar_id FROM scholars);
        UPDATE notifications SET created_by = 'admin' WHERE created_by IS NULL OR created_by NOT IN (SELECT username FROM admins);
        ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_scholar;
        ALTER TABLE notifications ADD CONSTRAINT fk_notifications_scholar
            FOREIGN KEY (scholar_id) REFERENCES scholars(scholar_id) ON DELETE CASCADE;
        ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_created_by;
        ALTER TABLE notifications ADD CONSTRAINT fk_notifications_created_by
            FOREIGN KEY (created_by) REFERENCES admins(username) ON DELETE SET NULL;

        CREATE TABLE IF NOT EXISTS system_settings (
            id INT PRIMARY KEY DEFAULT 1,
            academic_year VARCHAR(20) NOT NULL DEFAULT '2026-2027',
            semester VARCHAR(30) NOT NULL DEFAULT '1st Semester',
            renewal_open BOOLEAN NOT NULL DEFAULT TRUE,
            deadline DATE NOT NULL DEFAULT '2026-11-30',
            default_password VARCHAR(100) NOT NULL DEFAULT '123456',
            updated_by VARCHAR(50) DEFAULT 'admin' REFERENCES admins(username) ON DELETE SET NULL
        );

        -- Connect 'system_settings' to 'admins'
        ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50) DEFAULT 'admin';

        INSERT INTO system_settings (id, academic_year, semester, renewal_open, deadline, default_password, updated_by)
        VALUES (1, '2026-2027', '1st Semester', TRUE, '2026-11-30', '123456', 'admin')
        ON CONFLICT (id) DO NOTHING;

        UPDATE system_settings SET updated_by = 'admin' WHERE updated_by IS NULL OR updated_by NOT IN (SELECT username FROM admins);
        ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS fk_system_settings_updated_by;
        ALTER TABLE system_settings ADD CONSTRAINT fk_system_settings_updated_by
            FOREIGN KEY (updated_by) REFERENCES admins(username) ON DELETE SET NULL;

        CREATE TABLE IF NOT EXISTS password_reset_requests (
            id SERIAL PRIMARY KEY,
            scholar_id VARCHAR(50) NOT NULL REFERENCES scholars(scholar_id) ON DELETE CASCADE,
            reason TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            resolved_by VARCHAR(50) REFERENCES admins(username) ON DELETE SET NULL,
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 3NF Normalize and connect 'password_reset_requests' to 'scholars' and 'admins'
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

        -- Connect 'renewals' and 'renewal_documents' to 'staff'
        ALTER TABLE renewals ADD COLUMN IF NOT EXISTS evaluated_by VARCHAR(50);
        UPDATE renewals SET evaluated_by = 'staff' WHERE evaluated_by IS NOT NULL AND evaluated_by NOT IN (SELECT username FROM staff);
        ALTER TABLE renewals DROP CONSTRAINT IF EXISTS fk_renewals_evaluated_by;
        ALTER TABLE renewals ADD CONSTRAINT fk_renewals_evaluated_by
            FOREIGN KEY (evaluated_by) REFERENCES staff(username) ON DELETE SET NULL;

        ALTER TABLE renewal_documents ADD COLUMN IF NOT EXISTS verified_by VARCHAR(50);
        UPDATE renewal_documents SET verified_by = 'staff' WHERE verified_by IS NOT NULL AND verified_by NOT IN (SELECT username FROM staff);
        ALTER TABLE renewal_documents DROP CONSTRAINT IF EXISTS fk_renewal_docs_verified_by;
        ALTER TABLE renewal_documents ADD CONSTRAINT fk_renewal_docs_verified_by
            FOREIGN KEY (verified_by) REFERENCES staff(username) ON DELETE SET NULL;

        -- 3NF: Drop derived 'expected_scholars' from 'sdp_activities' (computed live from scholars in cluster_id)
        -- and connect 'sdp_activities' and 'sdp_completions' to 'admins'
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
            FOREIGN KEY (verified_by) REFERENCES staff(username) ON DELETE SET NULL;";

    await using (var initCmd = new NpgsqlCommand(initTablesSql, conn))
    {
        await initCmd.ExecuteNonQueryAsync();
    }

    // Automatically sync scholars' year_level in PostgreSQL based on their Scholar ID batch prefix:
    // e.g. '2024-01' -> Batch 2024 -> 3rd Year (in AY 2026-2027)
    //      '2025-01' -> Batch 2025 -> 2nd Year
    //      '2026-01' -> Batch 2026 -> 1st Year
    //      '2023-01' -> Batch 2023 -> 4th Year
    const string syncBatchYearLevelSql = @"
        UPDATE scholars
        SET year_level = CASE
            WHEN scholar_id LIKE '2026%' THEN '1st Year'
            WHEN scholar_id LIKE '2025%' THEN '2nd Year'
            WHEN scholar_id LIKE '2024%' THEN '3rd Year'
            WHEN scholar_id LIKE '2023%' OR scholar_id LIKE '2022%' THEN '4th Year'
            ELSE year_level
        END;";
    await using (var syncCmd = new NpgsqlCommand(syncBatchYearLevelSql, conn))
    {
        await syncCmd.ExecuteNonQueryAsync();
    }

    // Clean out any old mock document filenames
    const string cleanFakeDocsSql = @"
        DELETE FROM renewal_documents
        WHERE file_path IN ('grades_1st_sem.pdf', 'coe_2026.pdf', 'accomplishment_report.pdf', 'parent_consent.jpg');";
    await using (var cleanCmd = new NpgsqlCommand(cleanFakeDocsSql, conn))
    {
        await cleanCmd.ExecuteNonQueryAsync();
    }

    // Seed default SDP activities if sdp_activities is empty (fresh DB)
    const string seedSdpSql = @"
        INSERT INTO sdp_activities (title, category, target_date, cluster_id, target_year_level, expected_hours, status, created_by)
        SELECT v.title, v.category, CAST(v.target_date AS DATE), v.cluster_id, 'All Years', 4, v.status, 'admin'
        FROM (VALUES
            ('Academic Support & Peer Tutoring', 'Academic Support', '2026-08-15', NULL, 'completed'),
            ('Leadership & Civic Responsibility Training', 'Leadership Training', '2026-08-30', NULL, 'completed'),
            ('Scholars General Orientation', 'Seminar', '2026-09-10', NULL, 'completed'),
            ('Barangay Clean-up & Tree Planting Activity', 'Community Service', '2026-10-30', 'A', 'in_progress'),
            ('Financial Literacy & Career Webinar', 'Seminar', '2026-11-15', NULL, 'upcoming')
        ) AS v(title, category, target_date, cluster_id, status)
        WHERE NOT EXISTS (SELECT 1 FROM sdp_activities);";
    await using (var sdpSeedCmd = new NpgsqlCommand(seedSdpSql, conn))
    {
        await sdpSeedCmd.ExecuteNonQueryAsync();
    }

    // Seed the 4,000 CDO scholars if scholars table has fewer than 4,000 rows
    var seed4000Path = Path.Combine(Directory.GetCurrentDirectory(), "seed_4000_scholars.sql");
    if (File.Exists(seed4000Path))
    {
        var seed4000Sql = await File.ReadAllTextAsync(seed4000Path);
        await using var s4000Cmd = new NpgsqlCommand(seed4000Sql, conn);
        await s4000Cmd.ExecuteNonQueryAsync();
    }

    Console.WriteLine("=================================================================");
    Console.WriteLine("✓ Connected to PostgreSQL Database (scholarstrack) via C# .NET!");
    Console.WriteLine("✓ Scholar Batch Year Levels (e.g. 2024-xx -> 3rd Year) synced.");
    Console.WriteLine("✓ C# Web API Server running at: http://localhost:5000");
    Console.WriteLine("=================================================================");
}
catch (Exception ex)
{
    Console.WriteLine("=================================================================");
    Console.WriteLine($"⚠️ PostgreSQL Connection Notice: {ex.Message}");
    Console.WriteLine("=================================================================");
}

app.Run();
