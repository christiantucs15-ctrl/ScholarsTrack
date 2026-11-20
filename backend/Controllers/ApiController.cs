using Microsoft.AspNetCore.Mvc;
using Npgsql;
using ScholarsTrack.Api.Models;

namespace ScholarsTrack.Api.Controllers;

// =============================================================================
// Main API Controller for ScholarsTrack (C# ASP.NET Core + PostgreSQL)
// =============================================================================
[ApiController]
[Route("api")]
public class ApiController : ControllerBase
{
    private readonly string _connectionString;
    private readonly IWebHostEnvironment _env;

    public ApiController(IConfiguration configuration, IWebHostEnvironment env)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=scholarstrack;Username=postgres;Password=123456";
        _env = env;
    }

    // -------------------------------------------------------------------------
    // Helper: Automatically derive Year Level & Batch Year from Scholar ID
    // Example: In AY 2026-2027 (base year 2026):
    //   '2024-01' -> Batch 2024 -> (2026 - 2024 + 1) = 3 -> '3rd Year'
    //   '2025-01' -> Batch 2025 -> (2026 - 2025 + 1) = 2 -> '2nd Year'
    //   '2026-01' -> Batch 2026 -> (2026 - 2026 + 1) = 1 -> '1st Year'
    //   '2023-01' -> Batch 2023 -> (2026 - 2023 + 1) = 4 -> '4th Year'
    // -------------------------------------------------------------------------
    private static string ExtractBatchYear(string? scholarId)
    {
        if (string.IsNullOrWhiteSpace(scholarId)) return "2026";
        var clean = scholarId.Trim();
        if (clean.Length >= 4 && int.TryParse(clean.Substring(0, 4), out var yr) && yr >= 2018 && yr <= 2030)
        {
            return yr.ToString();
        }
        return "2026";
    }

    private static string DeriveYearLevelFromScholarId(string? scholarId, string? fallback = null)
    {
        if (!string.IsNullOrWhiteSpace(scholarId))
        {
            var clean = scholarId.Trim();
            if (clean.Length >= 4 && int.TryParse(clean.Substring(0, 4), out var batchYear) && batchYear >= 2018 && batchYear <= 2030)
            {
                const int currentAcademicStartYear = 2026; // AY 2026-2027
                var yearNum = Math.Clamp(currentAcademicStartYear - batchYear + 1, 1, 4);
                return yearNum switch
                {
                    1 => "1st Year",
                    2 => "2nd Year",
                    3 => "3rd Year",
                    _ => "4th Year"
                };
            }
        }
        return string.IsNullOrWhiteSpace(fallback) ? "1st Year" : fallback.Trim();
    }

    // -------------------------------------------------------------------------
    // Helper: Ranking-based Scholar Type ("Academic" vs "Non-Academic")
    // Out of 2,000 scholar applicants:
    //   - Rank 1 to 1,000    -> "Academic"     (Must maintain GWA <= 2.00)
    //   - Rank 1,001 to 2,000 -> "Non-Academic" (Must maintain Grade/GWA <= 3.00)
    // -------------------------------------------------------------------------
    private static (int Rank, string Type, string RequiredGwa) ResolveRankAndScholarType(string? scholarId, int? dbRank = null)
    {
        int rank = dbRank ?? 0;
        if (rank <= 0 && !string.IsNullOrWhiteSpace(scholarId))
        {
            var parts = scholarId.Trim().Split('-');
            if (parts.Length > 1 && int.TryParse(parts.Last(), out var seq) && seq > 0)
            {
                rank = seq;
            }
        }
        if (rank <= 0) rank = 1;

        var isAcademic = rank <= 1000;
        return (
            Rank: rank,
            Type: isAcademic ? "Academic" : "Non-Academic",
            RequiredGwa: isAcademic ? "2.00" : "3.00"
        );
    }

    private static bool _schemaNormalizedV7 = false;

    // Ensures all 13 tables in PostgreSQL have strict 3NF normalization and Foreign Key constraints:
    // users -> admins, staff, scholars
    private static async Task EnsureNormalizedSchemaAsync(NpgsqlConnection conn)
    {
        if (_schemaNormalizedV7) return;
        try
        {
            const string sql = @"
                ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
                ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'admin', 'evaluator', 'staff'));

                INSERT INTO users (username, password_hash, role)
                VALUES ('admin', '123456', 'admin'), ('evaluator', '123456', 'evaluator'), ('staff', '123456', 'evaluator')
                ON CONFLICT (username) DO NOTHING;

                -- 1. 'admins' table (dedicated profile table for Admin accounts)
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

                -- Drop legacy 'evaluators' table so only 'admins', 'staff', and 'scholars' exist
                ALTER TABLE renewals DROP CONSTRAINT IF EXISTS fk_renewals_evaluated_by;
                DROP TABLE IF EXISTS evaluators CASCADE;

                -- 3. 3NF on 'grades' and 'scholars': drop derived 'remarks' column and add 'applicant_rank' (1..1000 = Academic, 1001..2000 = Non-Academic)
                ALTER TABLE grades DROP COLUMN IF EXISTS remarks;
                ALTER TABLE scholars ADD COLUMN IF NOT EXISTS applicant_rank INT NOT NULL DEFAULT 1;
                UPDATE scholars SET applicant_rank = 1045 WHERE scholar_id IN ('2024-004', '2025-002') AND applicant_rank = 1;
                UPDATE scholars SET applicant_rank = 1280 WHERE scholar_id IN ('2024-005', '2026-002') AND applicant_rank = 1;

                -- 4. Connect notifications -> scholars & admins
                ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_by VARCHAR(50) DEFAULT 'admin';
                UPDATE notifications SET scholar_id = NULL WHERE scholar_id = '' OR scholar_id NOT IN (SELECT scholar_id FROM scholars);
                UPDATE notifications SET created_by = 'admin' WHERE created_by IS NULL OR created_by NOT IN (SELECT username FROM admins);
                ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_scholar;
                ALTER TABLE notifications ADD CONSTRAINT fk_notifications_scholar
                    FOREIGN KEY (scholar_id) REFERENCES scholars(scholar_id) ON DELETE CASCADE;
                ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_created_by;
                ALTER TABLE notifications ADD CONSTRAINT fk_notifications_created_by
                    FOREIGN KEY (created_by) REFERENCES admins(username) ON DELETE SET NULL;

                -- 5. Connect & 3NF normalize password_reset_requests -> scholars & admins
                CREATE TABLE IF NOT EXISTS password_reset_requests (
                    id SERIAL PRIMARY KEY,
                    scholar_id VARCHAR(50) NOT NULL,
                    reason TEXT,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    resolved_by VARCHAR(50),
                    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
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

                -- 6. Connect system_settings -> admins
                ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50) DEFAULT 'admin';
                UPDATE system_settings SET updated_by = 'admin' WHERE updated_by IS NULL OR updated_by NOT IN (SELECT username FROM admins);
                ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS fk_system_settings_updated_by;
                ALTER TABLE system_settings ADD CONSTRAINT fk_system_settings_updated_by
                    FOREIGN KEY (updated_by) REFERENCES admins(username) ON DELETE SET NULL;

                -- 7. Connect renewals & renewal_documents -> staff
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

                -- 8. 3NF on sdp_activities & sdp_completions: drop derived expected_scholars and connect to admins
                ALTER TABLE sdp_activities DROP COLUMN IF EXISTS expected_scholars;
                ALTER TABLE sdp_activities ADD COLUMN IF NOT EXISTS target_year_level VARCHAR(20) DEFAULT 'All Years';
                ALTER TABLE sdp_activities ADD COLUMN IF NOT EXISTS created_by VARCHAR(50) DEFAULT 'admin';
                UPDATE sdp_activities SET created_by = 'admin' WHERE created_by IS NULL OR created_by NOT IN (SELECT username FROM admins);
                ALTER TABLE sdp_activities DROP CONSTRAINT IF EXISTS fk_sdp_activities_created_by;
                ALTER TABLE sdp_activities ADD CONSTRAINT fk_sdp_activities_created_by
                    FOREIGN KEY (created_by) REFERENCES admins(username) ON DELETE SET NULL;

                ALTER TABLE sdp_completions DROP COLUMN IF EXISTS verified_by_admin;
                ALTER TABLE sdp_completions ALTER COLUMN completed_at DROP NOT NULL;
                ALTER TABLE sdp_completions ADD COLUMN IF NOT EXISTS time_in TIMESTAMP;
                ALTER TABLE sdp_completions ADD COLUMN IF NOT EXISTS time_out TIMESTAMP;
                ALTER TABLE sdp_completions ADD COLUMN IF NOT EXISTS verified_by VARCHAR(50) DEFAULT 'staff';
                UPDATE sdp_completions SET verified_by = 'staff' WHERE verified_by IS NULL OR verified_by NOT IN (SELECT username FROM staff);
                UPDATE sdp_completions SET time_in = COALESCE(time_in, completed_at), time_out = COALESCE(time_out, completed_at) WHERE completed_at IS NOT NULL;
                ALTER TABLE sdp_completions DROP CONSTRAINT IF EXISTS fk_sdp_completions_verified_by;
                ALTER TABLE sdp_completions ADD CONSTRAINT fk_sdp_completions_verified_by
                    FOREIGN KEY (verified_by) REFERENCES staff(username) ON DELETE SET NULL;";

            await using var cmd = new NpgsqlCommand(sql, conn);
            await cmd.ExecuteNonQueryAsync();

            // Also execute seed_4000_scholars.sql if present and scholars < 4,000
            var seedFile = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "seed_4000_scholars.sql");
            if (!System.IO.File.Exists(seedFile))
            {
                seedFile = Path.Combine(Directory.GetCurrentDirectory(), "seed_4000_scholars.sql");
            }
            if (System.IO.File.Exists(seedFile))
            {
                var seedSql = await System.IO.File.ReadAllTextAsync(seedFile);
                await using var seedCmd = new NpgsqlCommand(seedSql, conn);
                await seedCmd.ExecuteNonQueryAsync();
            }

            _schemaNormalizedV7 = true;
            Console.WriteLine("✓ All PostgreSQL tables (users -> admins, staff, scholars) normalized (3NF) and 4,000 CDO scholars seeded!");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Schema Normalization Notice] {ex.Message}");
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/auth/login - Authenticate Admin, Staff, or Scholar against PostgreSQL
    // -------------------------------------------------------------------------
    [HttpPost("auth/login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ScholarId) || string.IsNullOrWhiteSpace(req.Password))
        {
            return BadRequest(new { error = "Scholar ID and password are required." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            const string sql = @"
                SELECT u.username, u.password_hash, u.role,
                       COALESCE(s.name, st.name, a.name) AS name, s.school, s.course, s.year_level,
                       b.name AS barangay, c.name AS cluster
                FROM users u
                LEFT JOIN scholars s ON u.username = s.scholar_id
                LEFT JOIN staff st ON u.username = st.username
                LEFT JOIN admins a ON u.username = a.username
                LEFT JOIN barangays b ON s.barangay_id = b.id
                LEFT JOIN clusters c ON b.cluster_id = c.id
                WHERE LOWER(u.username) = LOWER(@username)";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("username", req.ScholarId.Trim());

            await using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                return Unauthorized(new { error = "Invalid ID/Username or password." });
            }

            var username = reader.GetString(reader.GetOrdinal("username"));
            var passwordHash = reader.GetString(reader.GetOrdinal("password_hash"));
            var role = reader.GetString(reader.GetOrdinal("role"));

            // Admin & Evaluator accounts always allow '123456' (or their stored password).
            // Student accounts allow '123456' while their password is still the initial default hash ($2... or 123456);
            // once a student sets a custom password, only their new password is accepted.
            bool isStaffOrAdmin = role == "admin" || role == "evaluator";
            bool isDefaultUnchanged = passwordHash == "123456" || passwordHash.StartsWith("$2");
            bool passwordMatches =
                (req.Password.Trim() == passwordHash) ||
                ((isStaffOrAdmin || isDefaultUnchanged) && req.Password.Trim() == "123456");

            if (!passwordMatches)
            {
                return Unauthorized(new { error = "Invalid ID/Username or password." });
            }

            var nameOrd = reader.GetOrdinal("name");
            var schoolOrd = reader.GetOrdinal("school");
            var courseOrd = reader.GetOrdinal("course");
            var yearOrd = reader.GetOrdinal("year_level");
            var brgyOrd = reader.GetOrdinal("barangay");
            var clusterOrd = reader.GetOrdinal("cluster");

            var defaultRoleName = role == "admin"
                ? "Admin"
                : role == "evaluator"
                ? "Scholarship Evaluator"
                : username;

            var userObj = new
            {
                scholarId = username,
                name = reader.IsDBNull(nameOrd) ? defaultRoleName : reader.GetString(nameOrd),
                role = role,
                school = reader.IsDBNull(schoolOrd) ? "" : reader.GetString(schoolOrd),
                course = reader.IsDBNull(courseOrd) ? "" : reader.GetString(courseOrd),
                yearLevel = DeriveYearLevelFromScholarId(username, reader.IsDBNull(yearOrd) ? "" : reader.GetString(yearOrd)),
                barangay = reader.IsDBNull(brgyOrd) ? "" : reader.GetString(brgyOrd),
                cluster = reader.IsDBNull(clusterOrd) ? "" : reader.GetString(clusterOrd)
            };

            return Ok(new
            {
                token = $"csharp-jwt-token-{username}",
                user = userObj
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Login Error] {ex.Message}");
            return StatusCode(500, new { error = $"PostgreSQL error: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // PUT /api/auth/change-password - Allow Scholar to change their password in PostgreSQL
    // -------------------------------------------------------------------------
    [HttpPut("auth/change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ScholarId) ||
            string.IsNullOrWhiteSpace(req.CurrentPassword) ||
            string.IsNullOrWhiteSpace(req.NewPassword))
        {
            return BadRequest(new { error = "Current password and new password are required." });
        }

        if (req.NewPassword.Trim().Length < 6)
        {
            return BadRequest(new { error = "New password must be at least 6 characters long." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            const string findSql = "SELECT username, password_hash FROM users WHERE LOWER(username) = LOWER(@u) LIMIT 1";
            string? dbUsername = null;
            string? dbPasswordHash = null;

            await using (var findCmd = new NpgsqlCommand(findSql, conn))
            {
                findCmd.Parameters.AddWithValue("u", req.ScholarId.Trim());
                await using var reader = await findCmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    dbUsername = reader.GetString(0);
                    dbPasswordHash = reader.GetString(1);
                }
            }

            if (dbUsername == null || dbPasswordHash == null)
            {
                return NotFound(new { error = "Account not found." });
            }

            bool isDefaultUnchanged = dbPasswordHash == "123456" || dbPasswordHash.StartsWith("$2");
            bool currentMatches = (req.CurrentPassword.Trim() == dbPasswordHash) || (isDefaultUnchanged && req.CurrentPassword.Trim() == "123456");

            if (!currentMatches)
            {
                return BadRequest(new { error = "Your current password is incorrect." });
            }

            const string updateSql = "UPDATE users SET password_hash = @newPwd WHERE LOWER(username) = LOWER(@u)";
            await using (var upCmd = new NpgsqlCommand(updateSql, conn))
            {
                upCmd.Parameters.AddWithValue("newPwd", req.NewPassword.Trim());
                upCmd.Parameters.AddWithValue("u", dbUsername);
                await upCmd.ExecuteNonQueryAsync();
            }

            return Ok(new { message = "Password updated successfully." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ChangePassword Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to update password: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/auth/forgot-password - Scholar requests a password reset from Admin
    // -------------------------------------------------------------------------
    [HttpPost("auth/forgot-password")]
    public async Task<IActionResult> RequestPasswordReset([FromBody] ForgotPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ScholarId))
        {
            return BadRequest(new { error = "Please enter your Scholar ID." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            // Ensure 3NF normalized password_reset_requests table exists with Foreign Keys
            const string ensureTblSql = @"
                CREATE TABLE IF NOT EXISTS password_reset_requests (
                    id SERIAL PRIMARY KEY,
                    scholar_id VARCHAR(50) NOT NULL REFERENCES scholars(scholar_id) ON DELETE CASCADE,
                    reason TEXT,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    resolved_by VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
                    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE password_reset_requests DROP COLUMN IF EXISTS scholar_name;
                ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(50);";
            await using (var tblCmd = new NpgsqlCommand(ensureTblSql, conn))
            {
                await tblCmd.ExecuteNonQueryAsync();
            }

            // Verify that the Scholar ID exists in scholars
            const string findSql = @"
                SELECT s.scholar_id, s.name
                FROM scholars s
                WHERE LOWER(s.scholar_id) = LOWER(@id)
                LIMIT 1";

            string? foundId = null;
            string? foundName = null;
            await using (var cmd = new NpgsqlCommand(findSql, conn))
            {
                cmd.Parameters.AddWithValue("id", req.ScholarId.Trim());
                await using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    foundId = reader.GetString(0);
                    foundName = reader.GetString(1);
                }
            }

            if (string.IsNullOrEmpty(foundId))
            {
                return NotFound(new { error = $"Scholar ID '{req.ScholarId.Trim()}' was not found." });
            }

            var reason = string.IsNullOrWhiteSpace(req.Reason)
                ? "Forgot personal password"
                : req.Reason.Trim();

            // Remove any older pending request for the same scholar, then insert fresh (3NF: only scholar_id is stored)
            const string delOldSql = "DELETE FROM password_reset_requests WHERE LOWER(scholar_id) = LOWER(@sId) AND status = 'pending'";
            await using (var delCmd = new NpgsqlCommand(delOldSql, conn))
            {
                delCmd.Parameters.AddWithValue("sId", foundId);
                await delCmd.ExecuteNonQueryAsync();
            }

            const string insSql = @"
                INSERT INTO password_reset_requests (scholar_id, reason, status)
                VALUES (@sId, @reason, 'pending')
                RETURNING id";
            await using (var insCmd = new NpgsqlCommand(insSql, conn))
            {
                insCmd.Parameters.AddWithValue("sId", foundId);
                insCmd.Parameters.AddWithValue("reason", reason);
                await insCmd.ExecuteNonQueryAsync();
            }

            // Notify Admin in the notifications table
            const string notifSql = @"
                INSERT INTO notifications (recipient_role, scholar_id, title, message, type)
                VALUES ('admin', @sId, 'Password Reset Request', @msg, 'warning')";
            await using (var nCmd = new NpgsqlCommand(notifSql, conn))
            {
                nCmd.Parameters.AddWithValue("sId", foundId);
                nCmd.Parameters.AddWithValue("msg", $"{foundName} ({foundId}) requested a password reset: {reason}.");
                await nCmd.ExecuteNonQueryAsync();
            }

            return Ok(new { message = "Your password reset request has been sent to the Admin." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ForgotPassword Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to submit reset request: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/auth/reset-requests - Admin fetches pending password reset requests
    // -------------------------------------------------------------------------
    [HttpGet("auth/reset-requests")]
    public async Task<IActionResult> GetPasswordResetRequests()
    {
        try
        {
            var list = new List<object>();
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            const string ensureTblSql = @"
                CREATE TABLE IF NOT EXISTS password_reset_requests (
                    id SERIAL PRIMARY KEY,
                    scholar_id VARCHAR(50) NOT NULL REFERENCES scholars(scholar_id) ON DELETE CASCADE,
                    reason TEXT,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    resolved_by VARCHAR(50) REFERENCES users(username) ON DELETE SET NULL,
                    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE password_reset_requests DROP COLUMN IF EXISTS scholar_name;
                ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(50);";
            await using (var tblCmd = new NpgsqlCommand(ensureTblSql, conn))
            {
                await tblCmd.ExecuteNonQueryAsync();
            }

            // 3NF Normalized query: JOIN scholars to retrieve s.name rather than duplicating scholar_name
            const string sql = @"
                SELECT r.id, r.scholar_id, s.name, COALESCE(r.reason, ''), TO_CHAR(r.requested_at, 'YYYY-MM-DD HH24:MI'), r.status
                FROM password_reset_requests r
                JOIN scholars s ON r.scholar_id = s.scholar_id
                WHERE r.status = 'pending'
                ORDER BY r.requested_at DESC";

            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new
                {
                    id = reader.GetInt32(0),
                    scholarId = reader.GetString(1),
                    scholarName = reader.GetString(2),
                    reason = reader.GetString(3),
                    requestedAt = reader.GetString(4),
                    status = reader.GetString(5)
                });
            }

            return Ok(list);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetResetRequests Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to fetch reset requests: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/auth/reset-password - Admin resets a Scholar's password back to default (123456)
    // -------------------------------------------------------------------------
    [HttpPost("auth/reset-password")]
    public async Task<IActionResult> AdminResetPassword([FromBody] AdminResetPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ScholarId))
        {
            return BadRequest(new { error = "Scholar ID is required." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            var sId = req.ScholarId.Trim();

            // Read default password from system_settings (fallback '123456')
            string defaultPwd = "123456";
            const string setSql = "SELECT default_password FROM system_settings WHERE id = 1";
            await using (var sCmd = new NpgsqlCommand(setSql, conn))
            {
                var val = await sCmd.ExecuteScalarAsync();
                if (val != null && !string.IsNullOrWhiteSpace(val.ToString()))
                    defaultPwd = val.ToString()!.Trim();
            }

            // Reset user's password in PostgreSQL
            const string upUserSql = "UPDATE users SET password_hash = @pwd WHERE LOWER(username) = LOWER(@sId)";
            await using (var uCmd = new NpgsqlCommand(upUserSql, conn))
            {
                uCmd.Parameters.AddWithValue("pwd", defaultPwd);
                uCmd.Parameters.AddWithValue("sId", sId);
                await uCmd.ExecuteNonQueryAsync();
            }

            // Mark any pending reset request for this scholar as resolved by admin
            const string resolveReqSql = "UPDATE password_reset_requests SET status = 'resolved', resolved_by = 'admin' WHERE LOWER(scholar_id) = LOWER(@sId)";
            await using (var rCmd = new NpgsqlCommand(resolveReqSql, conn))
            {
                rCmd.Parameters.AddWithValue("sId", sId);
                await rCmd.ExecuteNonQueryAsync();
            }

            // Notify the scholar that their password was reset
            const string notifSql = @"
                INSERT INTO notifications (recipient_role, scholar_id, title, message, type)
                VALUES ('student', @sId, 'Password Reset by Admin', @msg, 'info')";
            await using (var nCmd = new NpgsqlCommand(notifSql, conn))
            {
                nCmd.Parameters.AddWithValue("sId", sId);
                nCmd.Parameters.AddWithValue("msg", $"Your password was reset to the default password ({defaultPwd}) by the Admin. You can set a new password in My Profile.");
                await nCmd.ExecuteNonQueryAsync();
            }

            return Ok(new { scholarId = sId, defaultPassword = defaultPwd, message = $"Password for {sId} has been reset to {defaultPwd}." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AdminResetPassword Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to reset password: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // Helper: Resolve or auto-create scholar in PostgreSQL by Name or ScholarId
    // Handles cases where browser localStorage has an older session (e.g. Sarall Lumactod)
    // -------------------------------------------------------------------------
    private async Task<string?> ResolveOrCreateScholarAsync(NpgsqlConnection conn, string? scholarId, string? name)
    {
        var cleanId = scholarId?.Trim() ?? "";
        var cleanName = name?.Trim() ?? "";

        // 1. Try matching by exact Scholar Name first if provided
        if (!string.IsNullOrEmpty(cleanName) &&
            cleanName.ToLower() != "admin" &&
            cleanName.ToLower() != "student" &&
            cleanName.ToLower() != "evaluator" &&
            cleanName.ToLower() != "staff" &&
            !cleanName.ToLower().Contains("evaluator"))
        {
            const string byNameSql = "SELECT scholar_id FROM scholars WHERE LOWER(name) = LOWER(@name) LIMIT 1";
            await using var cmd = new NpgsqlCommand(byNameSql, conn);
            cmd.Parameters.AddWithValue("name", cleanName);
            var foundByName = await cmd.ExecuteScalarAsync();
            if (foundByName != null) return foundByName.ToString();

            // If a real name like 'Sarall Lumactod' is logged in but not in DB yet, auto-create her in PostgreSQL!
            var newId = (cleanId != "" && cleanId != "2025-001" && cleanId != "2025-002") ? cleanId : "2025-003";

            const string ensureUserSql = @"
                INSERT INTO users (username, password_hash, role)
                VALUES (@u, '123456', 'student')
                ON CONFLICT (username) DO NOTHING";
            await using (var uCmd = new NpgsqlCommand(ensureUserSql, conn))
            {
                uCmd.Parameters.AddWithValue("u", newId);
                await uCmd.ExecuteNonQueryAsync();
            }

            const string ensureScholarSql = @"
                INSERT INTO scholars (scholar_id, name, email, contact_number, barangay_id, school, course, year_level, status)
                VALUES (
                    @sId,
                    @sName,
                    @sEmail,
                    '0917-555-0199',
                    (SELECT id FROM barangays WHERE name = 'Carmen' LIMIT 1),
                    'City University',
                    'BS Information Technology',
                    '2nd Year',
                    'active'
                )
                ON CONFLICT (scholar_id) DO NOTHING";
            await using (var sCmd = new NpgsqlCommand(ensureScholarSql, conn))
            {
                sCmd.Parameters.AddWithValue("sId", newId);
                sCmd.Parameters.AddWithValue("sName", cleanName);
                sCmd.Parameters.AddWithValue("sEmail", $"{newId.ToLower()}@cityscholar.edu");
                await sCmd.ExecuteNonQueryAsync();
            }

            return newId;
        }

        // 2. Otherwise match by scholar_id
        if (!string.IsNullOrEmpty(cleanId))
        {
            const string byIdSql = "SELECT scholar_id FROM scholars WHERE LOWER(scholar_id) = LOWER(@id) LIMIT 1";
            await using var cmd = new NpgsqlCommand(byIdSql, conn);
            cmd.Parameters.AddWithValue("id", cleanId);
            var foundById = await cmd.ExecuteScalarAsync();
            if (foundById != null) return foundById.ToString();
        }

        return null;
    }

    // -------------------------------------------------------------------------
    // GET /api/students/me - Fetch the logged-in scholar's profile from PostgreSQL
    // -------------------------------------------------------------------------
    [HttpGet("students/me")]
    public async Task<IActionResult> GetMyProfile([FromQuery] string? scholarId, [FromQuery] string? name)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            var resolvedId = await ResolveOrCreateScholarAsync(conn, scholarId, name);

            const string sql = @"
                SELECT
                    s.scholar_id,
                    s.name,
                    COALESCE(s.email, '') AS email,
                    COALESCE(s.contact_number, '') AS contact_number,
                    COALESCE(s.school, 'City University') AS school,
                    s.course,
                    s.year_level,
                    s.status,
                    b.name AS barangay,
                    c.name AS cluster,
                    COALESCE(s.applicant_rank, 1) AS applicant_rank
                FROM scholars s
                JOIN barangays b ON s.barangay_id = b.id
                JOIN clusters c ON b.cluster_id = c.id
                WHERE (@resolvedId <> '' AND LOWER(s.scholar_id) = LOWER(@resolvedId))
                ORDER BY s.created_at ASC
                LIMIT 1";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("resolvedId", resolvedId ?? "");

            await using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                var sid = reader.GetString(0);
                var rankInfo = ResolveRankAndScholarType(sid, reader.GetInt32(10));
                return Ok(new ScholarDto
                {
                    ScholarId = sid,
                    Name = reader.GetString(1),
                    Email = reader.GetString(2),
                    ContactNumber = reader.GetString(3),
                    School = reader.GetString(4),
                    Course = reader.GetString(5),
                    YearLevel = DeriveYearLevelFromScholarId(sid, reader.GetString(6)),
                    Status = reader.GetString(7),
                    Barangay = reader.GetString(8),
                    Cluster = reader.GetString(9),
                    ApplicantRank = rankInfo.Rank,
                    ScholarshipType = rankInfo.Type,
                    RequiredGwa = rankInfo.RequiredGwa
                });
            }

            await reader.CloseAsync();

            // Fallback: if browser had an old session ID (like SCH-001), load first scholar in DB
            const string fallbackSql = @"
                SELECT
                    s.scholar_id,
                    s.name,
                    COALESCE(s.email, '') AS email,
                    COALESCE(s.contact_number, '') AS contact_number,
                    COALESCE(s.school, 'City University') AS school,
                    s.course,
                    s.year_level,
                    s.status,
                    b.name AS barangay,
                    c.name AS cluster,
                    COALESCE(s.applicant_rank, 1) AS applicant_rank
                FROM scholars s
                JOIN barangays b ON s.barangay_id = b.id
                JOIN clusters c ON b.cluster_id = c.id
                ORDER BY s.scholar_id ASC
                LIMIT 1";

            await using var fallbackCmd = new NpgsqlCommand(fallbackSql, conn);
            await using var fbReader = await fallbackCmd.ExecuteReaderAsync();
            if (await fbReader.ReadAsync())
            {
                var fbSid = fbReader.GetString(0);
                var fbRankInfo = ResolveRankAndScholarType(fbSid, fbReader.GetInt32(10));
                return Ok(new ScholarDto
                {
                    ScholarId = fbSid,
                    Name = fbReader.GetString(1),
                    Email = fbReader.GetString(2),
                    ContactNumber = fbReader.GetString(3),
                    School = fbReader.GetString(4),
                    Course = fbReader.GetString(5),
                    YearLevel = fbReader.GetString(6),
                    Status = fbReader.GetString(7),
                    Barangay = fbReader.GetString(8),
                    Cluster = fbReader.GetString(9),
                    ApplicantRank = fbRankInfo.Rank,
                    ScholarshipType = fbRankInfo.Type,
                    RequiredGwa = fbRankInfo.RequiredGwa
                });
            }

            return NotFound(new { error = "Scholar profile not found in PostgreSQL." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetMyProfile Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to fetch scholar profile: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/scholars - Fetch all scholars with School, Contact & Cluster
    // -------------------------------------------------------------------------
    [HttpGet("scholars")]
    public async Task<IActionResult> GetScholars()
    {
        try
        {
            var list = new List<ScholarDto>();

            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            const string sql = @"
                SELECT
                    s.scholar_id,
                    s.name,
                    COALESCE(s.email, '') AS email,
                    COALESCE(s.contact_number, '') AS contact_number,
                    COALESCE(s.school, 'City University') AS school,
                    s.course,
                    s.year_level,
                    s.status,
                    b.name AS barangay,
                    c.name AS cluster,
                    COALESCE(s.applicant_rank, 1) AS applicant_rank
                FROM scholars s
                JOIN barangays b ON s.barangay_id = b.id
                JOIN clusters c ON b.cluster_id = c.id
                ORDER BY COALESCE(s.applicant_rank, 1) ASC, s.created_at DESC";

            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                var sid = reader.GetString(0);
                var rankInfo = ResolveRankAndScholarType(sid, reader.GetInt32(10));
                list.Add(new ScholarDto
                {
                    ScholarId = sid,
                    Name = reader.GetString(1),
                    Email = reader.GetString(2),
                    ContactNumber = reader.GetString(3),
                    School = reader.GetString(4),
                    Course = reader.GetString(5),
                    YearLevel = DeriveYearLevelFromScholarId(sid, reader.GetString(6)),
                    Status = reader.GetString(7),
                    Barangay = reader.GetString(8),
                    Cluster = reader.GetString(9),
                    ApplicantRank = rankInfo.Rank,
                    ScholarshipType = rankInfo.Type,
                    RequiredGwa = rankInfo.RequiredGwa
                });
            }

            return Ok(list);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetScholars Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to fetch scholars from PostgreSQL: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/scholars - Create a new scholar in PostgreSQL database
    // -------------------------------------------------------------------------
    [HttpPost("scholars")]
    public async Task<IActionResult> CreateScholar([FromBody] CreateScholarRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ScholarId) ||
            string.IsNullOrWhiteSpace(req.Name) ||
            string.IsNullOrWhiteSpace(req.Barangay))
        {
            return BadRequest(new { error = "Scholar ID, Name, and Barangay are required." });
        }

        if (!System.Text.RegularExpressions.Regex.IsMatch(req.ScholarId.Trim(), @"^\d{4}-\d{4}$"))
        {
            return BadRequest(new { error = "Scholar ID must strictly follow the 'YYYY-0000' format (e.g. 2026-1501 or 2024-0005)." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            // 1. Find barangay_id and cluster name from the chosen barangay
            const string findBrgySql = @"
                SELECT b.id, c.name
                FROM barangays b
                JOIN clusters c ON b.cluster_id = c.id
                WHERE LOWER(b.name) = LOWER(@bName)";

            int barangayId;
            string clusterName;

            await using (var bCmd = new NpgsqlCommand(findBrgySql, conn))
            {
                bCmd.Parameters.AddWithValue("bName", req.Barangay.Trim());
                await using var reader = await bCmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return BadRequest(new { error = $"Barangay '{req.Barangay}' not found in PostgreSQL database." });
                }
                barangayId = reader.GetInt32(0);
                clusterName = reader.GetString(1);
            }

            var scholarId = req.ScholarId.Trim();
            var name = req.Name.Trim();
            var email = string.IsNullOrWhiteSpace(req.Email) ? $"{scholarId.ToLower()}@cityscholar.edu" : req.Email.Trim();
            var contact = string.IsNullOrWhiteSpace(req.ContactNumber) ? "" : req.ContactNumber.Trim();
            var school = string.IsNullOrWhiteSpace(req.School) ? "City University" : req.School.Trim();
            var course = string.IsNullOrWhiteSpace(req.Course) ? "BS Information Technology" : req.Course.Trim();
            // Automatically derive Year Level from Scholar ID batch year (e.g. 2024-01 -> 3rd Year)
            var yearLevel = DeriveYearLevelFromScholarId(scholarId, req.YearLevel);
            var rankInfo = ResolveRankAndScholarType(scholarId, req.ApplicantRank);

            // 2. Insert account into users table (default password: 123456)
            const string insertUserSql = @"
                INSERT INTO users (username, password_hash, role)
                VALUES (@username, '123456', 'student')
                ON CONFLICT (username) DO NOTHING";

            await using (var uCmd = new NpgsqlCommand(insertUserSql, conn))
            {
                uCmd.Parameters.AddWithValue("username", scholarId);
                await uCmd.ExecuteNonQueryAsync();
            }

            // 3. Insert profile into scholars table (with applicant_rank for Academic / Non-Academic classification)
            const string insertScholarSql = @"
                INSERT INTO scholars (scholar_id, name, email, contact_number, school, barangay_id, course, year_level, applicant_rank, status)
                VALUES (@scholarId, @name, @email, @contact, @school, @barangayId, @course, @yearLevel, @rank, 'active')";

            await using (var sCmd = new NpgsqlCommand(insertScholarSql, conn))
            {
                sCmd.Parameters.AddWithValue("scholarId", scholarId);
                sCmd.Parameters.AddWithValue("name", name);
                sCmd.Parameters.AddWithValue("email", email);
                sCmd.Parameters.AddWithValue("contact", contact);
                sCmd.Parameters.AddWithValue("school", school);
                sCmd.Parameters.AddWithValue("barangayId", barangayId);
                sCmd.Parameters.AddWithValue("course", course);
                sCmd.Parameters.AddWithValue("yearLevel", yearLevel);
                sCmd.Parameters.AddWithValue("rank", rankInfo.Rank);
                await sCmd.ExecuteNonQueryAsync();
            }

            // 4. Return newly created scholar DTO
            var created = new ScholarDto
            {
                ScholarId = scholarId,
                Name = name,
                Email = email,
                ContactNumber = contact,
                School = school,
                Barangay = req.Barangay,
                Cluster = clusterName,
                Course = course,
                YearLevel = yearLevel,
                ApplicantRank = rankInfo.Rank,
                ScholarshipType = rankInfo.Type,
                RequiredGwa = rankInfo.RequiredGwa,
                Status = "active"
            };

            return StatusCode(201, created);
        }
        catch (PostgresException pgEx) when (pgEx.SqlState == "23505")
        {
            return BadRequest(new { error = $"Scholar ID '{req.ScholarId}' already exists in the database." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CreateScholar Error] {ex.Message}");
            return StatusCode(500, new { error = $"PostgreSQL error: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/evaluators - Fetch all Staff / Evaluator accounts from PostgreSQL 'staff' table
    // -------------------------------------------------------------------------
    [HttpGet("evaluators")]
    public async Task<IActionResult> GetEvaluators()
    {
        try
        {
            var list = new List<EvaluatorDto>();
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            const string sql = @"
                SELECT id, username, name, COALESCE(email, ''), COALESCE(department, 'Scholarship Evaluation Office')
                FROM staff
                ORDER BY id ASC";

            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new EvaluatorDto
                {
                    Id = reader.GetInt32(0),
                    Username = reader.GetString(1),
                    Name = reader.GetString(2),
                    Email = reader.GetString(3),
                    Department = reader.GetString(4)
                });
            }

            return Ok(list);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetEvaluators Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to fetch staff accounts: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/evaluators - Admin creates a new Staff / Evaluator account in 'staff' table
    // -------------------------------------------------------------------------
    [HttpPost("evaluators")]
    public async Task<IActionResult> CreateEvaluator([FromBody] CreateEvaluatorRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { error = "Username/Staff ID and Full Name are required." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            var username = req.Username.Trim();
            var name = req.Name.Trim();
            var email = string.IsNullOrWhiteSpace(req.Email) ? $"{username.ToLower()}@cityscholar.edu" : req.Email.Trim();
            var department = string.IsNullOrWhiteSpace(req.Department) ? "Scholarship Evaluation Office" : req.Department.Trim();

            const string insertUserSql = @"
                INSERT INTO users (username, password_hash, role)
                VALUES (@username, '123456', 'evaluator')
                ON CONFLICT (username) DO UPDATE SET role = 'evaluator'";
            await using (var uCmd = new NpgsqlCommand(insertUserSql, conn))
            {
                uCmd.Parameters.AddWithValue("username", username);
                await uCmd.ExecuteNonQueryAsync();
            }

            const string insertStaffSql = @"
                INSERT INTO staff (username, name, email, department)
                VALUES (@username, @name, @email, @department)
                RETURNING id";
            int newId;
            await using (var eCmd = new NpgsqlCommand(insertStaffSql, conn))
            {
                eCmd.Parameters.AddWithValue("username", username);
                eCmd.Parameters.AddWithValue("name", name);
                eCmd.Parameters.AddWithValue("email", email);
                eCmd.Parameters.AddWithValue("department", department);
                newId = Convert.ToInt32(await eCmd.ExecuteScalarAsync());
            }

            return StatusCode(201, new EvaluatorDto
            {
                Id = newId,
                Username = username,
                Name = name,
                Email = email,
                Department = department
            });
        }
        catch (PostgresException pgEx) when (pgEx.SqlState == "23505")
        {
            return BadRequest(new { error = $"Staff Username '{req.Username}' already exists." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CreateEvaluator Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to create evaluator: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/renewals - Fetch semester renewals from PostgreSQL
    // Only shows renewals where the scholar has actually uploaded/submitted files!
    // -------------------------------------------------------------------------
    [HttpGet("renewals")]
    public async Task<IActionResult> GetRenewals([FromQuery] string? scholarId)
    {
        try
        {
            var list = new List<RenewalDto>();

            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            // Clean up any auto-created 'pending' renewals that have 0 uploaded files
            const string cleanupEmptySql = @"
                DELETE FROM renewals r
                WHERE r.status = 'pending'
                  AND NOT EXISTS (
                      SELECT 1 FROM renewal_documents rd WHERE rd.renewal_id = r.id
                  );";
            await using (var cleanupCmd = new NpgsqlCommand(cleanupEmptySql, conn))
            {
                await cleanupCmd.ExecuteNonQueryAsync();
            }

            const string sql = @"
                SELECT
                    r.id,
                    r.scholar_id,
                    s.name,
                    b.name AS barangay,
                    c.name AS cluster,
                    r.semester || ', ' || r.academic_year AS period,
                    TO_CHAR(r.submitted_at, 'YYYY-MM-DD') AS submitted_on,
                    r.status,
                    COALESCE(r.remarks, '') AS remarks,
                    COALESCE(s.applicant_rank, 1) AS applicant_rank
                FROM renewals r
                JOIN scholars s ON r.scholar_id = s.scholar_id
                JOIN barangays b ON s.barangay_id = b.id
                JOIN clusters c ON b.cluster_id = c.id
                WHERE (@scholarId = '' OR LOWER(r.scholar_id) = LOWER(@scholarId))
                ORDER BY r.submitted_at DESC, r.id DESC";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("scholarId", scholarId?.Trim() ?? "");
            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                var sid = reader.GetString(1);
                var rankInfo = ResolveRankAndScholarType(sid, reader.GetInt32(9));
                list.Add(new RenewalDto
                {
                    Id = reader.GetInt32(0),
                    ScholarId = sid,
                    Name = reader.GetString(2),
                    Barangay = reader.GetString(3),
                    Cluster = reader.GetString(4),
                    ApplicantRank = rankInfo.Rank,
                    ScholarshipType = rankInfo.Type,
                    RequiredGwa = rankInfo.RequiredGwa,
                    Period = reader.GetString(5),
                    SubmittedOn = reader.GetString(6),
                    Status = reader.GetString(7),
                    Remarks = reader.GetString(8)
                });
            }

            return Ok(list);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetRenewals Error] {ex.Message}");
            return StatusCode(500, new { error = "Failed to fetch renewals from PostgreSQL." });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/renewals/{id} - Fetch single renewal + documents for Admin Review
    // -------------------------------------------------------------------------
    [HttpGet("renewals/{id:int}")]
    public async Task<IActionResult> GetRenewalById(int id)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            const string sql = @"
                SELECT
                    r.id,
                    r.scholar_id,
                    s.name,
                    COALESCE(s.email, '') AS email,
                    b.name AS barangay,
                    c.name AS cluster,
                    s.course,
                    s.year_level,
                    r.semester || ', ' || r.academic_year AS period,
                    TO_CHAR(r.submitted_at, 'YYYY-MM-DD') AS submitted_on,
                    r.status,
                    COALESCE(r.remarks, '') AS remarks,
                    COALESCE(s.applicant_rank, 1) AS applicant_rank
                FROM renewals r
                JOIN scholars s ON r.scholar_id = s.scholar_id
                JOIN barangays b ON s.barangay_id = b.id
                JOIN clusters c ON b.cluster_id = c.id
                WHERE r.id = @id";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("id", id);

            await using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                return NotFound(new { error = "Renewal not found." });
            }

            var sid = reader.GetString(1);
            var rankInfo = ResolveRankAndScholarType(sid, reader.GetInt32(12));
            var renewalObj = new
            {
                id = reader.GetInt32(0),
                scholarId = sid,
                name = reader.GetString(2),
                email = reader.GetString(3),
                barangay = reader.GetString(4),
                cluster = reader.GetString(5),
                course = reader.GetString(6),
                yearLevel = DeriveYearLevelFromScholarId(sid, reader.GetString(7)),
                period = reader.GetString(8),
                submittedOn = reader.GetString(9),
                status = reader.GetString(10),
                remarks = reader.GetString(11),
                applicantRank = rankInfo.Rank,
                scholarshipType = rankInfo.Type,
                requiredGwa = rankInfo.RequiredGwa
            };
            await reader.CloseAsync();

            var docs = new List<object>();
            const string docSql = @"
                SELECT id, doc_type, file_path, COALESCE(file_size_kb, 1024), status
                FROM renewal_documents
                WHERE renewal_id = @id
                ORDER BY id ASC";

            await using var dCmd = new NpgsqlCommand(docSql, conn);
            dCmd.Parameters.AddWithValue("id", id);
            await using var dReader = await dCmd.ExecuteReaderAsync();
            while (await dReader.ReadAsync())
            {
                var kb = dReader.GetInt32(3);
                var sizeStr = kb >= 1000 ? $"{(kb / 1000.0):0.0} MB" : $"{kb} KB";
                docs.Add(new
                {
                    id = dReader.GetInt32(0),
                    name = dReader.GetString(1),
                    file = dReader.GetString(2),
                    size = sizeStr,
                    status = dReader.GetString(4)
                });
            }
            await dReader.CloseAsync();

            // Compute Scholar's GWA & Total Enrolled Units for the renewal's semester period
            // Note: When renewing for 2nd Semester, eligibility is based on completed 1st Semester grades!
            string gwa = "N/A";
            int totalUnits = 0;
            const string gradesSql = @"
                SELECT units, final_grade
                FROM grades
                WHERE LOWER(scholar_id) = LOWER(@sId)
                  AND LOWER(period) = LOWER(@period)";

            async Task ComputeGradesForPeriodAsync(string targetPeriod)
            {
                totalUnits = 0;
                double weightedSum = 0;
                await using var gCmd = new NpgsqlCommand(gradesSql, conn);
                gCmd.Parameters.AddWithValue("sId", sid);
                gCmd.Parameters.AddWithValue("period", targetPeriod);
                await using var gReader = await gCmd.ExecuteReaderAsync();
                while (await gReader.ReadAsync())
                {
                    var u = gReader.GetInt32(0);
                    var gr = gReader.GetString(1);
                    totalUnits += u;
                    if (double.TryParse(gr, out var num))
                        weightedSum += num * u;
                }
                if (totalUnits > 0)
                {
                    gwa = (weightedSum / totalUnits).ToString("0.00");
                }
            }

            await ComputeGradesForPeriodAsync(renewalObj.period);
            if (totalUnits == 0 && renewalObj.period.StartsWith("2nd Semester", StringComparison.OrdinalIgnoreCase))
            {
                var firstSemPeriod = renewalObj.period.Replace("2nd Semester", "1st Semester", StringComparison.OrdinalIgnoreCase);
                await ComputeGradesForPeriodAsync(firstSemPeriod);
            }

            // Compute Scholar's SDP Completion Count for Evaluator Eligibility Assessment
            int sdpCompleted = 0;
            int sdpTotal = 0;
            const string sdpSql = @"
                SELECT
                    (SELECT COUNT(*) FROM sdp_completions WHERE LOWER(scholar_id) = LOWER(@sId)),
                    (SELECT COUNT(*) FROM sdp_activities)";
            await using (var sdpCmd = new NpgsqlCommand(sdpSql, conn))
            {
                sdpCmd.Parameters.AddWithValue("sId", sid);
                await using var sReader = await sdpCmd.ExecuteReaderAsync();
                if (await sReader.ReadAsync())
                {
                    sdpCompleted = Convert.ToInt32(sReader.GetInt64(0));
                    sdpTotal = Convert.ToInt32(sReader.GetInt64(1));
                }
            }

            return Ok(new
            {
                renewalObj.id,
                renewalObj.scholarId,
                renewalObj.name,
                renewalObj.email,
                renewalObj.barangay,
                renewalObj.cluster,
                renewalObj.course,
                renewalObj.yearLevel,
                renewalObj.period,
                renewalObj.submittedOn,
                renewalObj.status,
                renewalObj.remarks,
                renewalObj.applicantRank,
                renewalObj.scholarshipType,
                renewalObj.requiredGwa,
                gwa,
                totalUnits,
                sdpCompleted,
                sdpTotal,
                documents = docs
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetRenewalById Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to load renewal details: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/renewals/target - Automatically identify the scholar's Batch Year,
    // Year Level (e.g. 2024-01 -> Batch 2024, 3rd Year), and which Semester
    // they are currently trying to renew!
    // -------------------------------------------------------------------------
    [HttpGet("renewals/target")]
    public async Task<IActionResult> GetRenewalTarget([FromQuery] string? scholarId, [FromQuery] string? name)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            var resolvedScholarId = await ResolveOrCreateScholarAsync(conn, scholarId, name);
            if (string.IsNullOrEmpty(resolvedScholarId))
            {
                const string firstSql = "SELECT scholar_id FROM scholars ORDER BY scholar_id ASC LIMIT 1";
                await using var fCmd = new NpgsqlCommand(firstSql, conn);
                resolvedScholarId = (await fCmd.ExecuteScalarAsync())?.ToString() ?? "2024-001";
            }

            // 1. Derive Batch Year and Year Level from the Scholar ID prefix (e.g. 2024-01 -> Batch 2024 -> 3rd Year)
            string dbYearLevel = "1st Year";
            const string sSql = "SELECT year_level FROM scholars WHERE LOWER(scholar_id) = LOWER(@sId) LIMIT 1";
            await using (var sCmd = new NpgsqlCommand(sSql, conn))
            {
                sCmd.Parameters.AddWithValue("sId", resolvedScholarId);
                var val = await sCmd.ExecuteScalarAsync();
                if (val != null) dbYearLevel = val.ToString() ?? "1st Year";
            }

            var batchYear = ExtractBatchYear(resolvedScholarId) ?? "2026";
            var yearLevel = DeriveYearLevelFromScholarId(resolvedScholarId, dbYearLevel);

            // 2. Read default active academic year & semester from system_settings
            string academicYear = "2026-2027";
            string semester = "1st Semester";
            const string setSql = "SELECT academic_year, semester FROM system_settings WHERE id = 1";
            await using (var setCmd = new NpgsqlCommand(setSql, conn))
            await using (var setReader = await setCmd.ExecuteReaderAsync())
            {
                if (await setReader.ReadAsync())
                {
                    academicYear = setReader.GetString(0);
                    semester = setReader.GetString(1);
                }
            }

            // 3. Automatically check if the scholar already completed/approved 1st Semester of this Academic Year;
            //    if 1st Semester is already approved, automatically advance them to 2nd Semester!
            const string checkApprovedSql = @"
                SELECT status FROM renewals
                WHERE LOWER(scholar_id) = LOWER(@sId)
                  AND academic_year = @ay
                  AND semester = '1st Semester'
                LIMIT 1";
            await using (var chkCmd = new NpgsqlCommand(checkApprovedSql, conn))
            {
                chkCmd.Parameters.AddWithValue("sId", resolvedScholarId);
                chkCmd.Parameters.AddWithValue("ay", academicYear);
                var firstSemStatus = (await chkCmd.ExecuteScalarAsync())?.ToString();
                if (string.Equals(firstSemStatus, "approved", StringComparison.OrdinalIgnoreCase))
                {
                    semester = "2nd Semester";
                }
            }

            // 4. Check existing renewal status and uploaded files for the identified target semester
            string existingStatus = "pending";
            int? renewalId = null;
            const string curRenSql = @"
                SELECT id, status FROM renewals
                WHERE LOWER(scholar_id) = LOWER(@sId)
                  AND academic_year = @ay
                  AND semester = @sem
                LIMIT 1";
            await using (var crCmd = new NpgsqlCommand(curRenSql, conn))
            {
                crCmd.Parameters.AddWithValue("sId", resolvedScholarId);
                crCmd.Parameters.AddWithValue("ay", academicYear);
                crCmd.Parameters.AddWithValue("sem", semester);
                await using var crReader = await crCmd.ExecuteReaderAsync();
                if (await crReader.ReadAsync())
                {
                    renewalId = crReader.GetInt32(0);
                    existingStatus = crReader.GetString(1);
                }
            }

            var uploadedDocs = new List<object>();
            if (renewalId.HasValue)
            {
                const string docsSql = @"
                    SELECT id, doc_type, file_path, COALESCE(file_size_kb, 1024), status
                    FROM renewal_documents
                    WHERE renewal_id = @rId
                    ORDER BY id ASC";
                await using var dCmd = new NpgsqlCommand(docsSql, conn);
                dCmd.Parameters.AddWithValue("rId", renewalId.Value);
                await using var dReader = await dCmd.ExecuteReaderAsync();
                while (await dReader.ReadAsync())
                {
                    uploadedDocs.Add(new
                    {
                        id = dReader.GetInt32(0),
                        docType = dReader.GetString(1),
                        file = dReader.GetString(2),
                        sizeKb = dReader.GetInt32(3),
                        status = dReader.GetString(4)
                    });
                }
            }

            // 5. Check prerequisite grades in PostgreSQL:
            //    Before a scholar is ready to renew for 2nd Semester, they must have 1st Semester subjects & grades encoded!
            var prerequisitePeriod = $"1st Semester, {academicYear}";
            int firstSemSubjectCount = 0;
            int firstSemUnits = 0;
            string firstSemGwa = "N/A";
            const string prereqGradesSql = @"
                SELECT units, final_grade
                FROM grades
                WHERE LOWER(scholar_id) = LOWER(@sId)
                  AND LOWER(period) = LOWER(@period)";
            await using (var pgCmd = new NpgsqlCommand(prereqGradesSql, conn))
            {
                pgCmd.Parameters.AddWithValue("sId", resolvedScholarId);
                pgCmd.Parameters.AddWithValue("period", prerequisitePeriod);
                await using var pgReader = await pgCmd.ExecuteReaderAsync();
                double wSum = 0;
                while (await pgReader.ReadAsync())
                {
                    firstSemSubjectCount++;
                    var u = pgReader.GetInt32(0);
                    var gr = pgReader.GetString(1);
                    firstSemUnits += u;
                    if (double.TryParse(gr, out var num)) wSum += num * u;
                }
                if (firstSemUnits > 0)
                {
                    firstSemGwa = (wSum / firstSemUnits).ToString("0.00");
                }
            }

            return Ok(new
            {
                scholarId = resolvedScholarId,
                batchYear,
                yearLevel,
                academicYear,
                semester,
                period = $"{semester}, {academicYear}",
                existingStatus,
                prerequisitePeriod,
                firstSemSubjectCount,
                firstSemUnits,
                firstSemGwa,
                hasFirstSemGrades = firstSemSubjectCount > 0,
                documents = uploadedDocs
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetRenewalTarget Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to determine renewal semester: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/renewals - Scholar submits or saves renewal + 4 documents
    // Automatically links the 4 documents to the identified semester renewal
    // so they immediately appear in My Documents (/student/documents).
    // -------------------------------------------------------------------------
    [HttpPost("renewals")]
    public async Task<IActionResult> SubmitRenewal([FromBody] SubmitRenewalRequest req)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            // Resolve or auto-create scholar from req.ScholarId / req.Name
            var resolvedScholarId = await ResolveOrCreateScholarAsync(conn, req.ScholarId, req.Name);

            if (string.IsNullOrEmpty(resolvedScholarId))
            {
                return BadRequest(new { error = "Scholar account not found in PostgreSQL." });
            }

            var newStatus = string.IsNullOrWhiteSpace(req.Status) ? "under_review" : req.Status;
            var academicYear = string.IsNullOrWhiteSpace(req.AcademicYear) ? "2026-2027" : req.AcademicYear.Trim();
            var semester = string.IsNullOrWhiteSpace(req.Semester) ? "1st Semester" : req.Semester.Trim();

            // Upsert renewal record for the identified semester & academic year
            const string upsertRenewalSql = @"
                INSERT INTO renewals (scholar_id, academic_year, semester, status, remarks, submitted_at)
                VALUES (@scholarId, @academicYear, @semester, @status, 'Submitted by scholar for verification.', CURRENT_TIMESTAMP)
                ON CONFLICT (scholar_id, academic_year, semester)
                DO UPDATE SET
                    status = EXCLUDED.status,
                    remarks = EXCLUDED.remarks,
                    submitted_at = CURRENT_TIMESTAMP
                RETURNING id;";

            int renewalId;
            await using (var rCmd = new NpgsqlCommand(upsertRenewalSql, conn))
            {
                rCmd.Parameters.AddWithValue("scholarId", resolvedScholarId);
                rCmd.Parameters.AddWithValue("academicYear", academicYear);
                rCmd.Parameters.AddWithValue("semester", semester);
                rCmd.Parameters.AddWithValue("status", newStatus);
                renewalId = Convert.ToInt32(await rCmd.ExecuteScalarAsync());
            }

            // Ensure all submitted documents are saved in renewal_documents so they show up in My Documents
            if (req.Documents != null && req.Documents.Count > 0)
            {
                foreach (var doc in req.Documents)
                {
                    if (string.IsNullOrWhiteSpace(doc.DocType) || string.IsNullOrWhiteSpace(doc.FileName))
                        continue;

                    // Delete existing doc of same type for this renewal, then insert fresh
                    const string delDocSql = @"
                        DELETE FROM renewal_documents
                        WHERE renewal_id = @rId AND doc_type = @docType";
                    await using (var delCmd = new NpgsqlCommand(delDocSql, conn))
                    {
                        delCmd.Parameters.AddWithValue("rId", renewalId);
                        delCmd.Parameters.AddWithValue("docType", doc.DocType.Trim());
                        await delCmd.ExecuteNonQueryAsync();
                    }

                    const string insDocSql = @"
                        INSERT INTO renewal_documents (renewal_id, doc_type, file_path, file_size_kb, status)
                        VALUES (@rId, @docType, @filePath, @sizeKb, 'pending')";
                    await using (var insCmd = new NpgsqlCommand(insDocSql, conn))
                    {
                        insCmd.Parameters.AddWithValue("rId", renewalId);
                        insCmd.Parameters.AddWithValue("docType", doc.DocType.Trim());
                        insCmd.Parameters.AddWithValue("filePath", doc.FileName.Trim());
                        insCmd.Parameters.AddWithValue("sizeKb", doc.FileSizeKb > 0 ? doc.FileSizeKb : 1024);
                        await insCmd.ExecuteNonQueryAsync();
                    }
                }
            }

            return Ok(new
            {
                id = renewalId,
                scholarId = resolvedScholarId,
                academicYear,
                semester,
                period = $"{semester}, {academicYear}",
                status = newStatus
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SubmitRenewal Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to submit renewal: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // PUT /api/renewals/{id}/status - Approve or Reject a renewal in PostgreSQL
    // -------------------------------------------------------------------------
    [HttpPut("renewals/{id:int}/status")]
    public async Task<IActionResult> UpdateRenewalStatus(int id, [FromBody] UpdateRenewalStatusRequest req)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            const string sql = @"
                UPDATE renewals
                SET status = @status,
                    remarks = @remarks,
                    evaluated_by = 'staff',
                    evaluated_at = CURRENT_TIMESTAMP
                WHERE id = @id
                RETURNING scholar_id, semester || ', ' || academic_year";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("status", req.Status);
            cmd.Parameters.AddWithValue("remarks", req.Remarks ?? "");
            cmd.Parameters.AddWithValue("id", id);

            string? scholarId = null;
            string? period = null;
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                if (await reader.ReadAsync())
                {
                    scholarId = reader.GetString(0);
                    period = reader.GetString(1);
                }
            }

            if (!string.IsNullOrEmpty(scholarId))
            {
                var isApproved = req.Status == "approved";
                const string notifSql = @"
                    INSERT INTO notifications (recipient_role, scholar_id, title, message, type)
                    VALUES ('student', @sId, @title, @msg, @type)";
                await using var nCmd = new NpgsqlCommand(notifSql, conn);
                nCmd.Parameters.AddWithValue("sId", scholarId);
                nCmd.Parameters.AddWithValue("title", isApproved ? "Renewal Approved" : "Renewal Update");
                nCmd.Parameters.AddWithValue("msg", $"Your scholarship renewal for {period} has been {req.Status}. {req.Remarks}");
                nCmd.Parameters.AddWithValue("type", isApproved ? "success" : "warning");
                await nCmd.ExecuteNonQueryAsync();
            }

            return Ok(new { id, status = req.Status, remarks = req.Remarks });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UpdateRenewalStatus Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to update renewal: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/sdp - Fetch all SDP activities from PostgreSQL
    // Automatically computes Expected Scholars from the live count of scholars
    // in the target cluster (or all clusters A to G if All Clusters).
    // -------------------------------------------------------------------------
    [HttpGet("sdp")]
    public async Task<IActionResult> GetSdpActivities([FromQuery] string? scholarId)
    {
        try
        {
            var list = new List<SdpActivityDto>();
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            var cleanScholarId = scholarId?.Trim() ?? "";
            string? scholarYearLevel = null;
            if (!string.IsNullOrEmpty(cleanScholarId))
            {
                scholarYearLevel = DeriveYearLevelFromScholarId(cleanScholarId, null);
            }

            const string sql = @"
                SELECT
                    a.id,
                    a.title,
                    a.category,
                    TO_CHAR(a.target_date, 'YYYY-MM-DD') AS target_date,
                    COALESCE(c.name, 'All Clusters') AS cluster_name,
                    COALESCE(a.target_year_level, 'All Years') AS target_year_level,
                    a.expected_hours,
                    (
                        SELECT COUNT(*)
                        FROM scholars s
                        JOIN barangays b ON s.barangay_id = b.id
                        WHERE (a.cluster_id IS NULL OR b.cluster_id = a.cluster_id)
                          AND (
                              a.target_year_level IS NULL
                              OR a.target_year_level = 'All Years'
                              OR LOWER(s.year_level) = LOWER(a.target_year_level)
                          )
                    ) AS live_expected_scholars,
                    a.status,
                    (SELECT COUNT(*) FROM sdp_completions sc WHERE sc.activity_id = a.id AND sc.time_out IS NOT NULL) AS completed_count,
                    COALESCE(TO_CHAR(my_sc.time_in, 'HH12:MI AM'), '') AS my_time_in,
                    COALESCE(TO_CHAR(my_sc.time_out, 'HH12:MI AM'), '') AS my_time_out
                FROM sdp_activities a
                LEFT JOIN clusters c ON a.cluster_id = c.id
                LEFT JOIN sdp_completions my_sc
                       ON my_sc.activity_id = a.id
                      AND @scholarId <> ''
                      AND LOWER(my_sc.scholar_id) = LOWER(@scholarId)
                WHERE (
                    @scholarYearLevel = ''
                    OR a.target_year_level IS NULL
                    OR a.target_year_level = 'All Years'
                    OR LOWER(a.target_year_level) = LOWER(@scholarYearLevel)
                )
                ORDER BY a.target_date ASC";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("scholarId", cleanScholarId);
            cmd.Parameters.AddWithValue("scholarYearLevel", scholarYearLevel ?? "");
            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                var myTimeIn = reader.GetString(10);
                var myTimeOut = reader.GetString(11);
                list.Add(new SdpActivityDto
                {
                    Id = reader.GetInt32(0),
                    Name = reader.GetString(1),
                    Category = reader.GetString(2),
                    TargetDate = reader.GetString(3),
                    Cluster = reader.GetString(4),
                    TargetYearLevel = reader.GetString(5),
                    ExpectedHours = reader.GetInt32(6),
                    TotalExpected = Convert.ToInt32(reader.GetInt64(7)),
                    Status = reader.GetString(8),
                    CompletedCount = Convert.ToInt32(reader.GetInt64(9)),
                    TimeIn = myTimeIn,
                    TimeOut = myTimeOut,
                    ScholarCompleted = !string.IsNullOrEmpty(myTimeOut)
                });
            }

            return Ok(list);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetSdp Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to fetch SDP activities: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/sdp - Create a new SDP activity in PostgreSQL
    // Automatically counts the scholars in the selected cluster (or All Clusters)
    // -------------------------------------------------------------------------
    [HttpPost("sdp")]
    public async Task<IActionResult> CreateSdpActivity([FromBody] CreateSdpRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.TargetDate))
        {
            return BadRequest(new { error = "Activity Name and Target Date are required." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            string? clusterId = null;
            if (!string.IsNullOrWhiteSpace(req.Cluster) && req.Cluster != "All Clusters")
            {
                // Extract letter ID e.g. 'Cluster A' -> 'A'
                var parts = req.Cluster.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var letter = parts.Last();
                if (letter.Length == 1) clusterId = letter.ToUpper();
            }

            var targetYearLevel = string.IsNullOrWhiteSpace(req.TargetYearLevel)
                ? "All Years"
                : req.TargetYearLevel.Trim();

            // Automatically count the number of registered scholars in the chosen cluster & year level
            const string countScholarsSql = @"
                SELECT COUNT(*)
                FROM scholars s
                JOIN barangays b ON s.barangay_id = b.id
                WHERE (@clusterId IS NULL OR b.cluster_id = @clusterId)
                  AND (@targetYear = 'All Years' OR LOWER(s.year_level) = LOWER(@targetYear))";

            int autoExpectedCount;
            await using (var cntCmd = new NpgsqlCommand(countScholarsSql, conn))
            {
                cntCmd.Parameters.Add(new NpgsqlParameter("clusterId", NpgsqlTypes.NpgsqlDbType.Varchar)
                {
                    Value = (object?)clusterId ?? DBNull.Value
                });
                cntCmd.Parameters.AddWithValue("targetYear", targetYearLevel);
                autoExpectedCount = Convert.ToInt32(await cntCmd.ExecuteScalarAsync());
            }

            // 3NF: expected_scholars is not stored as a redundant column; it is computed from scholars in cluster_id & target_year_level
            const string sql = @"
                INSERT INTO sdp_activities (title, category, target_date, cluster_id, target_year_level, status, created_by)
                VALUES (@title, @category, CAST(@targetDate AS DATE), @clusterId, @targetYear, 'upcoming', 'admin')
                RETURNING id";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("title", req.Name.Trim());
            cmd.Parameters.AddWithValue("category", req.Category);
            cmd.Parameters.AddWithValue("targetDate", req.TargetDate);
            cmd.Parameters.AddWithValue("clusterId", (object?)clusterId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("targetYear", targetYearLevel);

            var newId = Convert.ToInt32(await cmd.ExecuteScalarAsync());

            return StatusCode(201, new SdpActivityDto
            {
                Id = newId,
                Name = req.Name.Trim(),
                Category = req.Category,
                TargetDate = req.TargetDate,
                Cluster = string.IsNullOrWhiteSpace(req.Cluster) ? "All Clusters" : req.Cluster,
                TargetYearLevel = targetYearLevel,
                ExpectedHours = 4,
                CompletedCount = 0,
                TotalExpected = autoExpectedCount,
                Status = "upcoming"
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CreateSdp Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to create SDP activity: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/documents - Fetch uploaded renewal documents from PostgreSQL
    // -------------------------------------------------------------------------
    [HttpGet("documents")]
    public async Task<IActionResult> GetDocuments([FromQuery] string? scholarId, [FromQuery] string? name)
    {
        try
        {
            var list = new List<DocumentDto>();
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            var filterScholarId = scholarId?.Trim() ?? "";
            if (!string.IsNullOrWhiteSpace(scholarId) || !string.IsNullOrWhiteSpace(name))
            {
                var resolved = await ResolveOrCreateScholarAsync(conn, scholarId, name);
                if (!string.IsNullOrEmpty(resolved)) filterScholarId = resolved;
            }

            const string sql = @"
                SELECT
                    rd.id,
                    rd.renewal_id,
                    r.scholar_id,
                    s.name,
                    s.year_level,
                    c.name AS cluster,
                    r.semester || ', ' || r.academic_year AS period,
                    rd.doc_type,
                    rd.file_path,
                    COALESCE(rd.file_size_kb, 1024) AS file_size_kb,
                    TO_CHAR(rd.uploaded_at, 'YYYY-MM-DD') AS uploaded_date,
                    rd.status
                FROM renewal_documents rd
                JOIN renewals r ON rd.renewal_id = r.id
                JOIN scholars s ON r.scholar_id = s.scholar_id
                JOIN barangays b ON s.barangay_id = b.id
                JOIN clusters c ON b.cluster_id = c.id
                WHERE (@scholarId = '' OR LOWER(r.scholar_id) = LOWER(@scholarId))
                ORDER BY rd.uploaded_at DESC, rd.id ASC";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("scholarId", filterScholarId);

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var sid = reader.GetString(2);
                var kb = reader.GetInt32(9);
                var sizeStr = kb >= 1000 ? $"{(kb / 1000.0):0.0} MB" : $"{kb} KB";

                list.Add(new DocumentDto
                {
                    Id = reader.GetInt32(0),
                    RenewalId = reader.GetInt32(1),
                    ScholarId = sid,
                    ScholarName = reader.GetString(3),
                    YearLevel = DeriveYearLevelFromScholarId(sid, reader.GetString(4)),
                    Cluster = reader.GetString(5),
                    Period = reader.GetString(6),
                    DocType = reader.GetString(7),
                    File = reader.GetString(8),
                    Size = sizeStr,
                    Date = reader.GetString(10),
                    Status = reader.GetString(11)
                });
            }

            return Ok(list);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetDocuments Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to fetch documents: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // PUT /api/documents/{id}/status - Verify or Reject a document in PostgreSQL
    // -------------------------------------------------------------------------
    [HttpPut("documents/{id:int}/status")]
    public async Task<IActionResult> UpdateDocumentStatus(int id, [FromBody] UpdateDocStatusRequest req)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            const string sql = @"
                UPDATE renewal_documents
                SET status = @status,
                    verified_by = 'staff',
                    verified_at = CURRENT_TIMESTAMP
                WHERE id = @id";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("status", req.Status);
            cmd.Parameters.AddWithValue("id", id);

            await cmd.ExecuteNonQueryAsync();
            return Ok(new { id, status = req.Status });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UpdateDocStatus Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to update document status: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/documents/upload - Real Multipart File Upload to Server & PostgreSQL
    // Saves the physical PDF/Image into backend/wwwroot/uploads/ and records it in DB
    // under the scholar's identified renewal semester so it appears in My Documents.
    // -------------------------------------------------------------------------
    [HttpPost("documents/upload")]
    public async Task<IActionResult> UploadDocument(
        [FromForm] IFormFile? file,
        [FromForm] string? scholarId,
        [FromForm] string? name,
        [FromForm] string? docType,
        [FromForm] string? academicYear,
        [FromForm] string? semester)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "Please select a valid PDF, JPG, or PNG file." });
        }

        if (string.IsNullOrWhiteSpace(docType))
        {
            return BadRequest(new { error = "Document requirement type is required." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            // 1. Resolve or auto-create the scholar in PostgreSQL
            var resolvedScholarId = await ResolveOrCreateScholarAsync(conn, scholarId, name);
            if (string.IsNullOrEmpty(resolvedScholarId))
            {
                return BadRequest(new { error = "Scholar account could not be found in PostgreSQL." });
            }

            // 2. Save physical file into backend/wwwroot/uploads/
            var uploadsDir = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads");
            Directory.CreateDirectory(uploadsDir);

            var safeOriginalName = Path.GetFileName(file.FileName).Replace(" ", "_");
            var safeDocType = docType.Trim().Replace(" ", "_");
            var storedFileName = $"{resolvedScholarId}_{safeDocType}_{safeOriginalName}";
            var fullPath = Path.Combine(uploadsDir, storedFileName);

            await using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var sizeKb = Math.Max(1, (int)Math.Round(file.Length / 1024.0));
            var targetAcademicYear = string.IsNullOrWhiteSpace(academicYear) ? "2026-2027" : academicYear.Trim();
            var targetSemester = string.IsNullOrWhiteSpace(semester) ? "1st Semester" : semester.Trim();

            // 3. Ensure renewal row exists in PostgreSQL for the identified semester & academic year
            const string upsertRenewalSql = @"
                INSERT INTO renewals (scholar_id, academic_year, semester, status, remarks, submitted_at)
                VALUES (@scholarId, @academicYear, @semester, 'pending', 'Uploading renewal requirements.', CURRENT_TIMESTAMP)
                ON CONFLICT (scholar_id, academic_year, semester)
                DO UPDATE SET submitted_at = CURRENT_TIMESTAMP
                RETURNING id;";

            int renewalId;
            await using (var rCmd = new NpgsqlCommand(upsertRenewalSql, conn))
            {
                rCmd.Parameters.AddWithValue("scholarId", resolvedScholarId);
                rCmd.Parameters.AddWithValue("academicYear", targetAcademicYear);
                rCmd.Parameters.AddWithValue("semester", targetSemester);
                renewalId = Convert.ToInt32(await rCmd.ExecuteScalarAsync());
            }

            // 4. Replace previous file of this doc_type and insert the newly uploaded file
            const string delDocSql = @"
                DELETE FROM renewal_documents
                WHERE renewal_id = @rId AND doc_type = @docType";
            await using (var delCmd = new NpgsqlCommand(delDocSql, conn))
            {
                delCmd.Parameters.AddWithValue("rId", renewalId);
                delCmd.Parameters.AddWithValue("docType", docType.Trim());
                await delCmd.ExecuteNonQueryAsync();
            }

            const string insDocSql = @"
                INSERT INTO renewal_documents (renewal_id, doc_type, file_path, file_size_kb, status)
                VALUES (@rId, @docType, @filePath, @sizeKb, 'pending')
                RETURNING id;";
            int docId;
            await using (var insCmd = new NpgsqlCommand(insDocSql, conn))
            {
                insCmd.Parameters.AddWithValue("rId", renewalId);
                insCmd.Parameters.AddWithValue("docType", docType.Trim());
                insCmd.Parameters.AddWithValue("filePath", storedFileName);
                insCmd.Parameters.AddWithValue("sizeKb", sizeKb);
                docId = Convert.ToInt32(await insCmd.ExecuteScalarAsync());
            }

            // 5. Check if all 4 required documents are now uploaded; if so, mark renewal 'under_review'
            const string countSql = "SELECT COUNT(*) FROM renewal_documents WHERE renewal_id = @rId";
            await using (var cntCmd = new NpgsqlCommand(countSql, conn))
            {
                cntCmd.Parameters.AddWithValue("rId", renewalId);
                var count = Convert.ToInt32(await cntCmd.ExecuteScalarAsync());
                if (count >= 4)
                {
                    const string markReviewSql = @"
                        UPDATE renewals
                        SET status = 'under_review',
                            remarks = 'All 4 documents uploaded by scholar. Ready for admin verification.'
                        WHERE id = @rId AND status = 'pending'";
                    await using var mrCmd = new NpgsqlCommand(markReviewSql, conn);
                    mrCmd.Parameters.AddWithValue("rId", renewalId);
                    await mrCmd.ExecuteNonQueryAsync();
                }
            }

            // 6. Log a real notification in PostgreSQL for Evaluator & Admin
            const string notifSql = @"
                INSERT INTO notifications (recipient_role, scholar_id, title, message, type)
                VALUES
                    ('evaluator', @sId, 'Document Uploaded', @msg, 'info'),
                    ('admin', @sId, 'Document Uploaded', @msg, 'info')";
            await using (var nCmd = new NpgsqlCommand(notifSql, conn))
            {
                nCmd.Parameters.AddWithValue("sId", resolvedScholarId);
                nCmd.Parameters.AddWithValue("msg", $"Scholar {resolvedScholarId} uploaded {docType.Trim()} ({safeOriginalName}).");
                await nCmd.ExecuteNonQueryAsync();
            }

            return Ok(new
            {
                id = docId,
                renewalId,
                scholarId = resolvedScholarId,
                docType = docType.Trim(),
                file = storedFileName,
                fileUrl = $"http://localhost:5000/uploads/{storedFileName}",
                sizeKb
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UploadDocument Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to upload document: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // GET /uploads/{fileName} - Serve uploaded PDF, JPG, PNG files directly
    // -------------------------------------------------------------------------
    [HttpGet("/uploads/{fileName}")]
    public IActionResult GetUploadedFile(string fileName)
    {
        var safeName = Path.GetFileName(fileName);
        var fullPath = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", safeName);

        if (!System.IO.File.Exists(fullPath))
        {
            return NotFound("Uploaded file not found on server.");
        }

        var ext = Path.GetExtension(safeName).ToLowerInvariant();
        var contentType = ext switch
        {
            ".pdf" => "application/pdf",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            _ => "application/octet-stream"
        };

        return PhysicalFile(fullPath, contentType);
    }

    // -------------------------------------------------------------------------
    // GET /api/clusters - Fetch all 7 clusters, their 5 barangays, and live scholar count
    // -------------------------------------------------------------------------
    [HttpGet("clusters")]
    public async Task<IActionResult> GetClusters()
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            var clustersMap = new Dictionary<string, ClusterDto>();

            // 1. Load clusters and count scholars per cluster
            const string clusterSql = @"
                SELECT c.id, c.name, COUNT(s.scholar_id) AS scholar_count
                FROM clusters c
                LEFT JOIN barangays b ON b.cluster_id = c.id
                LEFT JOIN scholars s ON s.barangay_id = b.id
                GROUP BY c.id, c.name
                ORDER BY c.id ASC";

            await using (var cCmd = new NpgsqlCommand(clusterSql, conn))
            await using (var reader = await cCmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var id = reader.GetString(0);
                    clustersMap[id] = new ClusterDto
                    {
                        Id = id,
                        Name = reader.GetString(1),
                        ScholarCount = Convert.ToInt32(reader.GetInt64(2))
                    };
                }
            }

            // 2. Load the 35 barangays and attach them to their cluster
            const string brgySql = "SELECT cluster_id, name FROM barangays ORDER BY id ASC";
            await using (var bCmd = new NpgsqlCommand(brgySql, conn))
            await using (var bReader = await bCmd.ExecuteReaderAsync())
            {
                while (await bReader.ReadAsync())
                {
                    var cId = bReader.GetString(0);
                    var bName = bReader.GetString(1);
                    if (clustersMap.TryGetValue(cId, out var clusterDto))
                    {
                        clusterDto.Barangays.Add(bName);
                    }
                }
            }

            return Ok(clustersMap.Values.ToList());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetClusters Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to fetch clusters: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/sdp/{id}/attendance - Get scholars in the activity's target cluster
    // (or all scholars if All Clusters) and whether they completed this SDP event
    // -------------------------------------------------------------------------
    [HttpGet("sdp/{id:int}/attendance")]
    public async Task<IActionResult> GetSdpAttendance(int id)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            const string sql = @"
                SELECT
                    s.scholar_id,
                    s.name,
                    c.name AS cluster,
                    COALESCE(TO_CHAR(sc.time_in, 'HH12:MI AM'), '') AS time_in_str,
                    COALESCE(TO_CHAR(sc.time_out, 'HH12:MI AM'), '') AS time_out_str,
                    CASE WHEN sc.time_out IS NOT NULL THEN TRUE ELSE FALSE END AS completed
                FROM scholars s
                JOIN barangays b ON s.barangay_id = b.id
                JOIN clusters c ON b.cluster_id = c.id
                JOIN sdp_activities a ON a.id = @actId
                LEFT JOIN sdp_completions sc ON sc.scholar_id = s.scholar_id AND sc.activity_id = @actId
                WHERE (a.cluster_id IS NULL OR b.cluster_id = a.cluster_id)
                  AND (
                      a.target_year_level IS NULL
                      OR a.target_year_level = 'All Years'
                      OR LOWER(s.year_level) = LOWER(a.target_year_level)
                  )
                ORDER BY s.scholar_id ASC";

            var list = new List<object>();
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("actId", id);
            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                list.Add(new
                {
                    scholarId = reader.GetString(0),
                    name = reader.GetString(1),
                    cluster = reader.GetString(2),
                    timeIn = reader.GetString(3),
                    timeOut = reader.GetString(4),
                    completed = reader.GetBoolean(5)
                });
            }

            return Ok(list);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetSdpAttendance Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to load SDP attendance: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/sdp/{id}/attendance - Toggle a scholar's SDP completion in PostgreSQL
    // -------------------------------------------------------------------------
    [HttpPost("sdp/{id:int}/attendance")]
    public async Task<IActionResult> ToggleSdpAttendance(int id, [FromBody] ToggleSdpAttendanceRequest req)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            if (req.Completed)
            {
                const string insertSql = @"
                    INSERT INTO sdp_completions (activity_id, scholar_id, time_in, time_out, completed_at, verified_by)
                    VALUES (@actId, @sId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'staff')
                    ON CONFLICT (activity_id, scholar_id)
                    DO UPDATE SET
                        time_in = COALESCE(sdp_completions.time_in, CURRENT_TIMESTAMP),
                        time_out = CURRENT_TIMESTAMP,
                        completed_at = CURRENT_TIMESTAMP,
                        verified_by = 'staff'";
                await using var cmd = new NpgsqlCommand(insertSql, conn);
                cmd.Parameters.AddWithValue("actId", id);
                cmd.Parameters.AddWithValue("sId", req.ScholarId);
                await cmd.ExecuteNonQueryAsync();
            }
            else
            {
                const string deleteSql = @"
                    DELETE FROM sdp_completions
                    WHERE activity_id = @actId AND scholar_id = @sId";
                await using var cmd = new NpgsqlCommand(deleteSql, conn);
                cmd.Parameters.AddWithValue("actId", id);
                cmd.Parameters.AddWithValue("sId", req.ScholarId);
                await cmd.ExecuteNonQueryAsync();
            }

            // Return updated completion count for this activity
            const string countSql = "SELECT COUNT(*) FROM sdp_completions WHERE activity_id = @actId AND time_out IS NOT NULL";
            await using var countCmd = new NpgsqlCommand(countSql, conn);
            countCmd.Parameters.AddWithValue("actId", id);
            var completedCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync());

            return Ok(new { activityId = id, scholarId = req.ScholarId, completed = req.Completed, completedCount });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ToggleSdpAttendance Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to update SDP attendance: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/sdp/{id}/scan-qr - Staff/Evaluator scans a Scholar's Profile QR Code
    // Records Time-In or Time-Out in 'sdp_completions' and verifies cluster eligibility!
    // -------------------------------------------------------------------------
    [HttpPost("sdp/{id:int}/scan-qr")]
    public async Task<IActionResult> ScanSdpQr(int id, [FromBody] ScanSdpQrRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.QrValue))
        {
            return BadRequest(new { error = "Please scan or enter a valid Scholar QR code." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            // Parse QR payload: accepts "SCHOLARSTRACK:2024-001", URL with ?scan=2024-001, or raw "2024-001"
            var raw = req.QrValue.Trim();
            if (raw.StartsWith("SCHOLARSTRACK:", StringComparison.OrdinalIgnoreCase))
            {
                raw = raw.Substring("SCHOLARSTRACK:".Length).Trim();
            }
            if (raw.Contains("scan=", StringComparison.OrdinalIgnoreCase))
            {
                var idx = raw.IndexOf("scan=", StringComparison.OrdinalIgnoreCase);
                raw = Uri.UnescapeDataString(raw.Substring(idx + 5).Split('&')[0]).Trim();
            }
            // If QR has extra segments e.g. "2024-001|Name", take the ID part
            if (raw.Contains('|'))
            {
                raw = raw.Split('|')[0].Trim();
            }
            var idMatch = System.Text.RegularExpressions.Regex.Match(raw, @"\b(20\d{2}-\d{2,4})\b");
            if (idMatch.Success)
            {
                raw = idMatch.Groups[1].Value;
            }

            // 1. Verify the SDP activity exists
            string actTitle = "";
            string? actClusterId = null;
            string actClusterName = "All Clusters";
            string actTargetYearLevel = "All Years";
            const string actSql = @"
                SELECT a.title, a.cluster_id, COALESCE(c.name, 'All Clusters'), COALESCE(a.target_year_level, 'All Years')
                FROM sdp_activities a
                LEFT JOIN clusters c ON a.cluster_id = c.id
                WHERE a.id = @actId";
            await using (var aCmd = new NpgsqlCommand(actSql, conn))
            {
                aCmd.Parameters.AddWithValue("actId", id);
                await using var aReader = await aCmd.ExecuteReaderAsync();
                if (!await aReader.ReadAsync())
                {
                    return NotFound(new { error = "SDP Activity not found." });
                }
                actTitle = aReader.GetString(0);
                actClusterId = aReader.IsDBNull(1) ? null : aReader.GetString(1);
                actClusterName = aReader.GetString(2);
                actTargetYearLevel = aReader.GetString(3);
            }

            // 2. Look up Scholar by Scholar ID
            string? foundScholarId = null;
            string? foundScholarName = null;
            string? scholarClusterId = null;
            string? scholarClusterName = null;
            string? scholarYearLevel = null;
            const string schSql = @"
                SELECT s.scholar_id, s.name, b.cluster_id, c.name, s.year_level
                FROM scholars s
                JOIN barangays b ON s.barangay_id = b.id
                JOIN clusters c ON b.cluster_id = c.id
                WHERE LOWER(s.scholar_id) = LOWER(@sId)
                LIMIT 1";
            await using (var sCmd = new NpgsqlCommand(schSql, conn))
            {
                sCmd.Parameters.AddWithValue("sId", raw);
                await using var sReader = await sCmd.ExecuteReaderAsync();
                if (await sReader.ReadAsync())
                {
                    foundScholarId = sReader.GetString(0);
                    foundScholarName = sReader.GetString(1);
                    scholarClusterId = sReader.GetString(2);
                    scholarClusterName = sReader.GetString(3);
                    scholarYearLevel = DeriveYearLevelFromScholarId(foundScholarId, sReader.GetString(4));
                }
            }

            if (string.IsNullOrEmpty(foundScholarId))
            {
                return NotFound(new { error = $"Scholar ID '{raw}' was not found in the database." });
            }

            if (actClusterId != null && !string.Equals(actClusterId, scholarClusterId, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    error = $"{foundScholarName} ({foundScholarId}) belongs to {scholarClusterName}, but this activity is only for {actClusterName}."
                });
            }

            if (!string.IsNullOrWhiteSpace(actTargetYearLevel) &&
                !string.Equals(actTargetYearLevel, "All Years", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(actTargetYearLevel, scholarYearLevel, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    error = $"{foundScholarName} ({foundScholarId}) is a {scholarYearLevel} scholar, but this SDP activity is dedicated only to {actTargetYearLevel}."
                });
            }

            var mode = (req.Mode?.Trim().ToLower() == "time_out") ? "time_out" : "time_in";
            string timeInStr = "";
            string timeOutStr = "";
            bool isCompleted = false;

            if (mode == "time_in")
            {
                const string timeInSql = @"
                    INSERT INTO sdp_completions (activity_id, scholar_id, time_in, time_out, completed_at, verified_by)
                    VALUES (@actId, @sId, CURRENT_TIMESTAMP, NULL, NULL, 'staff')
                    ON CONFLICT (activity_id, scholar_id)
                    DO UPDATE SET
                        time_in = COALESCE(sdp_completions.time_in, CURRENT_TIMESTAMP),
                        verified_by = 'staff'
                    RETURNING
                        COALESCE(TO_CHAR(time_in, 'HH12:MI AM'), ''),
                        COALESCE(TO_CHAR(time_out, 'HH12:MI AM'), ''),
                        CASE WHEN time_out IS NOT NULL THEN TRUE ELSE FALSE END";

                await using (var tiCmd = new NpgsqlCommand(timeInSql, conn))
                {
                    tiCmd.Parameters.AddWithValue("actId", id);
                    tiCmd.Parameters.AddWithValue("sId", foundScholarId);
                    await using var r = await tiCmd.ExecuteReaderAsync();
                    if (await r.ReadAsync())
                    {
                        timeInStr = r.GetString(0);
                        timeOutStr = r.GetString(1);
                        isCompleted = r.GetBoolean(2);
                    }
                }

                // Notify scholar of Time-In (non-blocking)
                try
                {
                    const string notifSql = @"
                        INSERT INTO notifications (recipient_role, scholar_id, created_by, title, message, type)
                        VALUES ('student', @sId, 'admin', 'SDP Time-In Recorded', @msg, 'info')";
                    await using var nCmd = new NpgsqlCommand(notifSql, conn);
                    nCmd.Parameters.AddWithValue("sId", foundScholarId);
                    nCmd.Parameters.AddWithValue("msg", $"Your Time-In ({timeInStr}) for '{actTitle}' was scanned and recorded.");
                    await nCmd.ExecuteNonQueryAsync();
                }
                catch { /* Ignore notification error */ }
            }
            else
            {
                // Time-Out: check if scholar has timed in first
                const string checkInSql = "SELECT time_in FROM sdp_completions WHERE activity_id = @actId AND scholar_id = @sId";
                object? existingTimeIn;
                await using (var chkCmd = new NpgsqlCommand(checkInSql, conn))
                {
                    chkCmd.Parameters.AddWithValue("actId", id);
                    chkCmd.Parameters.AddWithValue("sId", foundScholarId);
                    existingTimeIn = await chkCmd.ExecuteScalarAsync();
                }

                if (existingTimeIn == null || existingTimeIn == DBNull.Value)
                {
                    return BadRequest(new
                    {
                        error = $"{foundScholarName} ({foundScholarId}) has not Timed In yet! Please scan Time-In first."
                    });
                }

                const string timeOutSql = @"
                    UPDATE sdp_completions
                    SET time_out = CURRENT_TIMESTAMP,
                        completed_at = CURRENT_TIMESTAMP,
                        verified_by = 'staff'
                    WHERE activity_id = @actId AND scholar_id = @sId
                    RETURNING
                        COALESCE(TO_CHAR(time_in, 'HH12:MI AM'), ''),
                        COALESCE(TO_CHAR(time_out, 'HH12:MI AM'), '')";

                await using (var toCmd = new NpgsqlCommand(timeOutSql, conn))
                {
                    toCmd.Parameters.AddWithValue("actId", id);
                    toCmd.Parameters.AddWithValue("sId", foundScholarId);
                    await using var r = await toCmd.ExecuteReaderAsync();
                    if (await r.ReadAsync())
                    {
                        timeInStr = r.GetString(0);
                        timeOutStr = r.GetString(1);
                        isCompleted = true;
                    }
                }

                // Notify scholar of Time-Out & SDP Completion (non-blocking)
                try
                {
                    const string notifSql = @"
                        INSERT INTO notifications (recipient_role, scholar_id, created_by, title, message, type)
                        VALUES ('student', @sId, 'admin', 'SDP Activity Completed', @msg, 'success')";
                    await using var nCmd = new NpgsqlCommand(notifSql, conn);
                    nCmd.Parameters.AddWithValue("sId", foundScholarId);
                    nCmd.Parameters.AddWithValue("msg", $"Your Time-Out ({timeOutStr}) for '{actTitle}' was scanned. Your SDP attendance is now officially completed!");
                    await nCmd.ExecuteNonQueryAsync();
                }
                catch { /* Ignore notification error */ }
            }

            // Count total completed for this activity
            const string countSql = "SELECT COUNT(*) FROM sdp_completions WHERE activity_id = @actId AND time_out IS NOT NULL";
            await using var countCmd = new NpgsqlCommand(countSql, conn);
            countCmd.Parameters.AddWithValue("actId", id);
            var completedCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync());

            return Ok(new
            {
                activityId = id,
                scholarId = foundScholarId,
                name = foundScholarName,
                cluster = scholarClusterName,
                timeIn = timeInStr,
                timeOut = timeOutStr,
                completed = isCompleted,
                completedCount,
                message = mode == "time_in"
                    ? $"Time-In recorded for {foundScholarName} ({foundScholarId}) at {timeInStr}."
                    : $"Time-Out recorded for {foundScholarName} ({foundScholarId}) at {timeOutStr}. SDP Activity Completed!"
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ScanSdpQr Error] {ex.Message}");
            return StatusCode(500, new { error = $"QR scan failed: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // Helper: Returns curriculum subjects matching a scholar's degree program (scholars.course)
    // -------------------------------------------------------------------------
    private static List<(string Code, string Name, int Units, string Grade)> GetCurriculumForProgram(string? courseProgram)
    {
        var prog = (courseProgram ?? "").Trim().ToLower();

        if (prog.Contains("nurs"))
        {
            return new List<(string, string, int, string)>
            {
                ("NCM 112", "Care of Clients with Problems in Oxygenation, Fluid & Electrolytes", 5, "1.50"),
                ("NCM 113", "Community Health Nursing II (Population Groups & Community)", 4, "1.25"),
                ("NCM 114", "Care of the Older Adult (Geriatric Nursing)", 3, "1.50"),
                ("NURS 301", "Nursing Research 1", 3, "1.50"),
                ("BIOSTAT", "Biostatistics for Nursing", 3, "1.25")
            };
        }

        if (prog.Contains("tourism") || prog.Contains("hospitality") || prog.Contains("hm"))
        {
            return new List<(string, string, int, string)>
            {
                ("TM 301", "Philippine Culture and Tourism Geography", 3, "1.25"),
                ("TM 302", "Tour and Travel Management", 3, "1.50"),
                ("TM 303", "Sustainable Tourism Development", 3, "1.25"),
                ("TM 304", "Foreign Language 1 (Hospitality & Tourism)", 3, "1.50"),
                ("TM 305", "Transportation and Cruise Line Operations", 3, "1.50")
            };
        }

        if (prog.Contains("office"))
        {
            return new List<(string, string, int, string)>
            {
                ("OAD 201", "Administrative Office Procedures and Management", 3, "1.25"),
                ("OAD 202", "Business Report Writing & Executive Correspondence", 3, "1.50"),
                ("OAD 203", "Machine Shorthand and Transcription", 3, "1.25"),
                ("OAD 204", "Records and Information Management", 3, "1.50"),
                ("OAD 205", "Customer Relations and Front Office Operations", 3, "1.25")
            };
        }

        if (prog.Contains("entrep") || prog.Contains("business") || prog.Contains("bsba") || prog.Contains("econ"))
        {
            return new List<(string, string, int, string)>
            {
                ("BUS 201", "Principles of Management and Organization", 3, "1.25"),
                ("BUS 202", "Entrepreneurial Behavior and Opportunity Seeking", 3, "1.50"),
                ("BUS 203", "Marketing Management and Strategy", 3, "1.25"),
                ("BUS 204", "Managerial Economics and Financial Analysis", 3, "1.50"),
                ("BUS 205", "Business Law and Obligations & Contracts", 3, "1.25")
            };
        }

        if (prog.Contains("account") || prog.Contains("bsa") || prog.Contains("finance"))
        {
            return new List<(string, string, int, string)>
            {
                ("ACTG 201", "Intermediate Accounting 1", 6, "1.50"),
                ("ACTG 202", "Cost Accounting and Control", 3, "1.25"),
                ("BLAW 201", "Law on Obligations and Contracts", 3, "1.50"),
                ("TAX 201", "Income Taxation", 3, "1.50"),
                ("ECON 201", "Microeconomic Theory and Practice", 3, "1.25")
            };
        }

        if (prog.Contains("educ") || prog.Contains("teaching") || prog.Contains("beed") || prog.Contains("bsed") || prog.Contains("btvted") || prog.Contains("btled") || prog.Contains("livelihood"))
        {
            return new List<(string, string, int, string)>
            {
                ("EDUC 201", "Facilitating Learner-Centered Teaching", 3, "1.25"),
                ("EDUC 202", "Assessment in Learning 1", 3, "1.50"),
                ("EDUC 203", "The Teacher and the School Curriculum", 3, "1.25"),
                ("EDUC 204", "Technology for Teaching and Learning 1", 3, "1.25"),
                ("EDUC 205", "Foundation of Special and Inclusive Education", 3, "1.50")
            };
        }

        if ((prog.Contains("engin") && !prog.Contains("computer") && !prog.Contains("marine")) || prog.Contains("civil") || prog.Contains("mech") || prog.Contains("electr") || prog.Contains("arch"))
        {
            return new List<(string, string, int, string)>
            {
                ("ENGR 201", "Differential Equations for Engineers", 3, "1.50"),
                ("ENGR 202", "Mechanics of Deformable Bodies & Structural Design", 4, "1.75"),
                ("ENGR 203", "Engineering Economics & Project Management", 3, "1.25"),
                ("ENGR 204", "Computer-Aided Drafting and Design (CAD)", 3, "1.25"),
                ("ENGR 205", "Thermodynamics and Fluid Mechanics", 4, "1.50")
            };
        }

        if (prog.Contains("crim"))
        {
            return new List<(string, string, int, string)>
            {
                ("CRIM 201", "Theories of Crime Causation", 3, "1.50"),
                ("CDI 201", "Fundamentals of Criminal Investigation and Intelligence", 4, "1.25"),
                ("CLJ 201", "Philippine Criminal Justice System", 3, "1.50"),
                ("FOREN 201", "Personal Identification Techniques", 3, "1.25"),
                ("LEA 201", "Law Enforcement Operations and Planning", 3, "1.50")
            };
        }

        if (prog.Contains("marine") || prog.Contains("maritime"))
        {
            return new List<(string, string, int, string)>
            {
                ("MAR 201", "Terrestrial and Coastal Navigation 1", 4, "1.50"),
                ("MAR 202", "Ship, Ship Routines and Ship Construction", 3, "1.25"),
                ("MAR 203", "Maritime Law and International Conventions", 3, "1.50"),
                ("MAR 204", "Meteorology and Oceanography 1", 3, "1.50"),
                ("MAR 205", "Basic Marine Engineering & Safety", 3, "1.25")
            };
        }

        if (prog.Contains("med") || prog.Contains("pharm") || prog.Contains("radio") || prog.Contains("nutri") || prog.Contains("midwif"))
        {
            return new List<(string, string, int, string)>
            {
                ("HLT 201", "Human Anatomy and Physiology with Pathophysiology", 5, "1.50"),
                ("HLT 202", "Clinical Chemistry and Laboratory Diagnostics", 4, "1.25"),
                ("HLT 203", "Pharmacology and Therapeutics", 3, "1.50"),
                ("HLT 204", "Medical Microbiology and Parasitology", 4, "1.50"),
                ("HLT 205", "Public Health and Epidemiology", 3, "1.25")
            };
        }

        if (prog.Contains("agri") || prog.Contains("bio") || prog.Contains("chem") || prog.Contains("math"))
        {
            return new List<(string, string, int, string)>
            {
                ("SCI 201", "General Ecology and Environmental Science", 4, "1.25"),
                ("SCI 202", "Analytical Methods and Quantitative Research", 4, "1.50"),
                ("SCI 203", "Organic and Applied Biochemistry", 4, "1.25"),
                ("SCI 204", "Statistical Analysis for Natural Sciences", 3, "1.50"),
                ("SCI 205", "Scientific Instrumentation and Laboratory Techniques", 3, "1.25")
            };
        }

        if (prog.Contains("psych") || prog.Contains("social") || prog.Contains("comm") || prog.Contains("arts") || prog.Contains("pol") || prog.Contains("english") || prog.Contains("music") || prog.Contains("lib"))
        {
            return new List<(string, string, int, string)>
            {
                ("HUM 201", "Theories of Personality & Human Behavior", 3, "1.25"),
                ("HUM 202", "Social Science Research Methods & Statistics", 3, "1.50"),
                ("HUM 203", "Development Communication and Media Ethics", 3, "1.25"),
                ("HUM 204", "Community Organization and Social Welfare", 3, "1.50"),
                ("HUM 205", "Philippine Society, Culture, and Governance", 3, "1.25")
            };
        }

        if ((prog.Contains("tesda") || prog.Contains("vocational")) && !prog.Contains("it"))
        {
            return new List<(string, string, int, string)>
            {
                ("TVET 101", "Occupational Health and Safety Procedures (OHSP)", 3, "1.25"),
                ("TVET 102", "Technical Blueprint Reading and Trade Mensuration", 3, "1.50"),
                ("TVET 103", "Core Trade Competency & Applied Workshop Lab 1", 5, "1.25"),
                ("TVET 104", "Core Trade Competency & Applied Workshop Lab 2", 5, "1.50"),
                ("TVET 105", "Workplace Communication and Entrepreneurship", 3, "1.25")
            };
        }

        // Default: BS Information Technology / Computer Science
        return new List<(string, string, int, string)>
        {
            ("IT 201", "Data Structures and Algorithms", 3, "1.25"),
            ("IT 202", "Object-Oriented Programming", 3, "1.50"),
            ("IT 203", "Information Management & Database Systems", 3, "1.25"),
            ("IT 204", "Networking 1 (Fundamentals)", 3, "1.50"),
            ("IT 205", "Human-Computer Interaction", 3, "1.25")
        };
    }

    // -------------------------------------------------------------------------
    // GET /api/grades - Fetch scholar's semester grades & GWA from PostgreSQL
    // Automatically ensures each scholar's courses are aligned with their degree program!
    // -------------------------------------------------------------------------
    [HttpGet("grades")]
    public async Task<IActionResult> GetGrades([FromQuery] string? scholarId, [FromQuery] string? name)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            var resolvedScholarId = await ResolveOrCreateScholarAsync(conn, scholarId, name);
            if (string.IsNullOrEmpty(resolvedScholarId))
            {
                const string firstSql = "SELECT scholar_id FROM scholars ORDER BY scholar_id ASC LIMIT 1";
                await using var fCmd = new NpgsqlCommand(firstSql, conn);
                resolvedScholarId = (await fCmd.ExecuteScalarAsync())?.ToString() ?? "2024-001";
            }

            // Look up the scholar's degree program (course) in PostgreSQL
            string scholarProgram = "BS Information Technology";
            await using (var progCmd = new NpgsqlCommand("SELECT COALESCE(course, 'BS Information Technology') FROM scholars WHERE LOWER(scholar_id) = LOWER(@sId) LIMIT 1", conn))
            {
                progCmd.Parameters.AddWithValue("sId", resolvedScholarId);
                var pVal = await progCmd.ExecuteScalarAsync();
                if (pVal != null && !string.IsNullOrWhiteSpace(pVal.ToString()))
                {
                    scholarProgram = pVal.ToString()!.Trim();
                }
            }

            var expectedCurriculum = GetCurriculumForProgram(scholarProgram);
            bool isItOrCsProgram = expectedCurriculum.FirstOrDefault().Code.StartsWith("IT ", StringComparison.OrdinalIgnoreCase);

            // Check if the scholar has mismatched IT seed courses when their program is NOT IT/CS, or has 0 subjects
            long totalGradesCount = 0;
            long mismatchedItCount = 0;
            const string checkGradesSql = @"
                SELECT
                    COUNT(*),
                    COUNT(*) FILTER (WHERE course_code LIKE 'IT %' OR course_code LIKE 'CS %')
                FROM grades
                WHERE LOWER(scholar_id) = LOWER(@sId)";
            await using (var chkCmd = new NpgsqlCommand(checkGradesSql, conn))
            {
                chkCmd.Parameters.AddWithValue("sId", resolvedScholarId);
                await using var chkReader = await chkCmd.ExecuteReaderAsync();
                if (await chkReader.ReadAsync())
                {
                    totalGradesCount = chkReader.GetInt64(0);
                    mismatchedItCount = chkReader.GetInt64(1);
                }
            }

            if (totalGradesCount == 0 || (!isItOrCsProgram && mismatchedItCount > 0))
            {
                if (!isItOrCsProgram && mismatchedItCount > 0)
                {
                    await using var delMismatchCmd = new NpgsqlCommand(
                        "DELETE FROM grades WHERE LOWER(scholar_id) = LOWER(@sId) AND (course_code LIKE 'IT %' OR course_code LIKE 'CS %' OR course_code LIKE 'GE %')",
                        conn);
                    delMismatchCmd.Parameters.AddWithValue("sId", resolvedScholarId);
                    await delMismatchCmd.ExecuteNonQueryAsync();
                }

                // Re-count remaining subjects
                await using var remCmd = new NpgsqlCommand("SELECT COUNT(*) FROM grades WHERE LOWER(scholar_id) = LOWER(@sId)", conn);
                remCmd.Parameters.AddWithValue("sId", resolvedScholarId);
                var remaining = Convert.ToInt64(await remCmd.ExecuteScalarAsync());

                if (remaining == 0)
                {
                    var curriculum = GetCurriculumForProgram(scholarProgram);
                    const string seedSubjSql = @"
                        INSERT INTO grades (scholar_id, period, course_code, course_name, units, final_grade)
                        VALUES (@sId, '1st Semester, 2026-2027', @code, @name, @units, @grade)";
                    foreach (var subj in curriculum)
                    {
                        await using var insCmd = new NpgsqlCommand(seedSubjSql, conn);
                        insCmd.Parameters.AddWithValue("sId", resolvedScholarId);
                        insCmd.Parameters.AddWithValue("code", subj.Code);
                        insCmd.Parameters.AddWithValue("name", subj.Name);
                        insCmd.Parameters.AddWithValue("units", subj.Units);
                        insCmd.Parameters.AddWithValue("grade", subj.Grade);
                        await insCmd.ExecuteNonQueryAsync();
                    }
                }
            }

            const string sql = @"
                SELECT id, period, course_code, course_name, units, final_grade
                FROM grades
                WHERE LOWER(scholar_id) = LOWER(@sId)
                ORDER BY id ASC";

            var grouped = new Dictionary<string, List<GradeSubjectDto>>();
            await using (var cmd = new NpgsqlCommand(sql, conn))
            {
                cmd.Parameters.AddWithValue("sId", resolvedScholarId);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var period = reader.GetString(1);
                    if (!grouped.ContainsKey(period))
                        grouped[period] = new List<GradeSubjectDto>();

                    var gradeVal = reader.GetString(5);
                    var computedRemarks = (double.TryParse(gradeVal, out var numG) && numG > 3.0) ? "failed" : "passed";

                    grouped[period].Add(new GradeSubjectDto
                    {
                        Id = reader.GetInt32(0),
                        Code = reader.GetString(2),
                        Name = reader.GetString(3),
                        Units = reader.GetInt32(4),
                        Grade = gradeVal,
                        Remarks = computedRemarks
                    });
                }
            }

            var result = new List<SemesterGradesDto>();
            foreach (var kvp in grouped)
            {
                var totalUnits = kvp.Value.Sum(x => x.Units);
                double weightedSum = 0;
                foreach (var sub in kvp.Value)
                {
                    if (double.TryParse(sub.Grade, out var numericGrade))
                        weightedSum += numericGrade * sub.Units;
                }
                var gwa = totalUnits > 0 ? (weightedSum / totalUnits).ToString("0.00") : "0.00";

                result.Add(new SemesterGradesDto
                {
                    Period = kvp.Key,
                    Gwa = gwa,
                    Units = totalUnits,
                    Status = "passed",
                    Subjects = kvp.Value
                });
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetGrades Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to fetch grades: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/grades - Student manually inputs a subject, units, and grade for a semester
    // -------------------------------------------------------------------------
    [HttpPost("grades")]
    public async Task<IActionResult> AddGradeSubject([FromBody] CreateGradeRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.SubjectName))
        {
            return BadRequest(new { error = "Course Code and Subject Description are required." });
        }

        if (req.Units <= 0)
        {
            return BadRequest(new { error = "Units must be at least 1." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            var resolvedScholarId = await ResolveOrCreateScholarAsync(conn, req.ScholarId, req.Name);
            if (string.IsNullOrEmpty(resolvedScholarId))
            {
                return BadRequest(new { error = "Scholar profile not found." });
            }

            var period = string.IsNullOrWhiteSpace(req.Period) ? "1st Semester, 2026-2027" : req.Period.Trim();
            var gradeStr = string.IsNullOrWhiteSpace(req.Grade) ? "1.50" : req.Grade.Trim();

            // Determine passed/failed remarks dynamically (3NF: not stored as a redundant column)
            var remarks = "passed";
            if (double.TryParse(gradeStr, out var numericGrade) && numericGrade > 3.0)
            {
                remarks = "failed";
            }

            const string insertSql = @"
                INSERT INTO grades (scholar_id, period, course_code, course_name, units, final_grade)
                VALUES (@sId, @period, @code, @name, @units, @grade)
                RETURNING id";

            await using var cmd = new NpgsqlCommand(insertSql, conn);
            cmd.Parameters.AddWithValue("sId", resolvedScholarId);
            cmd.Parameters.AddWithValue("period", period);
            cmd.Parameters.AddWithValue("code", req.Code.Trim().ToUpper());
            cmd.Parameters.AddWithValue("name", req.SubjectName.Trim());
            cmd.Parameters.AddWithValue("units", req.Units);
            cmd.Parameters.AddWithValue("grade", gradeStr);

            var newId = Convert.ToInt32(await cmd.ExecuteScalarAsync());

            return StatusCode(201, new GradeSubjectDto
            {
                Id = newId,
                Code = req.Code.Trim().ToUpper(),
                Name = req.SubjectName.Trim(),
                Units = req.Units,
                Grade = gradeStr,
                Remarks = remarks
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AddGradeSubject Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to save subject: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // DELETE /api/grades/{id} - Remove a subject from a scholar's semester grades
    // -------------------------------------------------------------------------
    [HttpDelete("grades/{id:int}")]
    public async Task<IActionResult> DeleteGradeSubject(int id)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            const string sql = "DELETE FROM grades WHERE id = @id";
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("id", id);
            await cmd.ExecuteNonQueryAsync();

            return Ok(new { id, deleted = true });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DeleteGradeSubject Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to remove subject: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/notifications - Fetch notifications from PostgreSQL for Admin or Scholar
    // -------------------------------------------------------------------------
    [HttpGet("notifications")]
    public async Task<IActionResult> GetNotifications([FromQuery] string? role, [FromQuery] string? scholarId)
    {
        try
        {
            var list = new List<NotificationDto>();
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            await EnsureNormalizedSchemaAsync(conn);

            // Clean up any legacy technical seed notification text
            await using (var cleanCmd = new NpgsqlCommand("DELETE FROM notifications WHERE message LIKE '%PostgreSQL%';", conn))
            {
                await cleanCmd.ExecuteNonQueryAsync();
            }

            var targetRole = string.IsNullOrWhiteSpace(role) ? "student" : role.Trim().ToLower();
            var targetScholar = scholarId?.Trim() ?? "";

            const string sql = @"
                SELECT id, title, message, TO_CHAR(created_at, 'YYYY-MM-DD') AS date_str, type, is_read
                FROM notifications
                WHERE LOWER(recipient_role) = @role
                  AND (scholar_id IS NULL OR scholar_id = '' OR @scholarId = '' OR LOWER(scholar_id) = LOWER(@scholarId))
                ORDER BY created_at DESC, id DESC
                LIMIT 30";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("role", targetRole);
            cmd.Parameters.AddWithValue("scholarId", targetScholar);

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new NotificationDto
                {
                    Id = reader.GetInt32(0),
                    Title = reader.GetString(1),
                    Message = reader.GetString(2),
                    Date = reader.GetString(3),
                    Type = reader.GetString(4),
                    Read = reader.GetBoolean(5)
                });
            }

            return Ok(list);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetNotifications Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to fetch notifications: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/notifications - Admin creates a notification / announcement
    // -------------------------------------------------------------------------
    [HttpPost("notifications")]
    public async Task<IActionResult> CreateNotification([FromBody] CreateNotificationRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title) || string.IsNullOrWhiteSpace(req.Message))
        {
            return BadRequest(new { error = "Notification title and message are required." });
        }

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            var role = string.IsNullOrWhiteSpace(req.RecipientRole) ? "student" : req.RecipientRole.Trim().ToLower();
            var scholarId = string.IsNullOrWhiteSpace(req.ScholarId) ? null : req.ScholarId.Trim();
            var notifType = (req.Type?.Trim().ToLower()) switch
            {
                "warning" => "warning",
                "success" => "success",
                _ => "info"
            };
            var title = req.Title.Trim();
            var message = req.Message.Trim();

            const string insertSql = @"
                INSERT INTO notifications (recipient_role, scholar_id, title, message, type, is_read)
                VALUES (@role, @scholarId, @title, @message, @type, @isRead)
                RETURNING id, TO_CHAR(created_at, 'YYYY-MM-DD')";

            // 1. Insert for the target audience (student, evaluator, or both if 'all')
            var targetRoles = role == "all"
                ? new[] { "student", "evaluator" }
                : new[] { role };

            foreach (var r in targetRoles)
            {
                await using var cmd = new NpgsqlCommand(insertSql, conn);
                cmd.Parameters.AddWithValue("role", r);
                cmd.Parameters.AddWithValue("scholarId", r == "student" && scholarId != null ? (object)scholarId : DBNull.Value);
                cmd.Parameters.AddWithValue("title", title);
                cmd.Parameters.AddWithValue("message", message);
                cmd.Parameters.AddWithValue("type", notifType);
                cmd.Parameters.AddWithValue("isRead", false);
                await cmd.ExecuteNonQueryAsync();
            }

            // 2. Also record a copy in the Admin's notification list so Admin sees sent announcements
            int adminNotifId = 0;
            string dateStr = DateTime.Now.ToString("yyyy-MM-dd");
            var audienceLabel = role == "all"
                ? "All Scholars & Evaluators"
                : role == "evaluator"
                ? "Evaluators / Staff"
                : scholarId != null
                ? $"Scholar {scholarId}"
                : "All Scholars";

            await using (var adminCmd = new NpgsqlCommand(insertSql, conn))
            {
                adminCmd.Parameters.AddWithValue("role", "admin");
                adminCmd.Parameters.AddWithValue("scholarId", DBNull.Value);
                adminCmd.Parameters.AddWithValue("title", $"{title} (Sent to {audienceLabel})");
                adminCmd.Parameters.AddWithValue("message", message);
                adminCmd.Parameters.AddWithValue("type", notifType);
                adminCmd.Parameters.AddWithValue("isRead", true);

                await using var reader = await adminCmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    adminNotifId = reader.GetInt32(0);
                    dateStr = reader.GetString(1);
                }
            }

            return Ok(new NotificationDto
            {
                Id = adminNotifId,
                Title = $"{title} (Sent to {audienceLabel})",
                Message = message,
                Date = dateStr,
                Type = notifType,
                Read = true
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CreateNotification Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to create notification: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // PUT /api/notifications/{id}/read - Mark a single notification as read in PostgreSQL
    // -------------------------------------------------------------------------
    [HttpPut("notifications/{id:int}/read")]
    public async Task<IActionResult> MarkNotificationRead(int id)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            const string sql = "UPDATE notifications SET is_read = TRUE WHERE id = @id";
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("id", id);
            await cmd.ExecuteNonQueryAsync();

            return Ok(new { id, read = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // -------------------------------------------------------------------------
    // PUT /api/notifications/read-all - Mark all notifications as read for a role
    // -------------------------------------------------------------------------
    [HttpPut("notifications/read-all")]
    public async Task<IActionResult> MarkAllNotificationsRead([FromQuery] string? role)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            var targetRole = string.IsNullOrWhiteSpace(role) ? "student" : role.Trim().ToLower();
            const string sql = "UPDATE notifications SET is_read = TRUE WHERE LOWER(recipient_role) = @role";
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("role", targetRole);
            await cmd.ExecuteNonQueryAsync();

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // -------------------------------------------------------------------------
    // DELETE /api/notifications/{id} - Delete a notification from PostgreSQL
    // -------------------------------------------------------------------------
    [HttpDelete("notifications/{id:int}")]
    public async Task<IActionResult> DeleteNotification(int id)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            // Check if this is an Admin-sent broadcast notification so we also retract it for recipients
            string? notifTitle = null;
            string? notifMessage = null;
            await using (var findCmd = new NpgsqlCommand("SELECT title, message FROM notifications WHERE id = @id", conn))
            {
                findCmd.Parameters.AddWithValue("id", id);
                await using var reader = await findCmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    notifTitle = reader.GetString(0);
                    notifMessage = reader.GetString(1);
                }
            }

            await using (var delCmd = new NpgsqlCommand("DELETE FROM notifications WHERE id = @id", conn))
            {
                delCmd.Parameters.AddWithValue("id", id);
                await delCmd.ExecuteNonQueryAsync();
            }

            if (!string.IsNullOrEmpty(notifTitle) && notifTitle.Contains(" (Sent to ") && notifMessage != null)
            {
                var origTitle = notifTitle.Split(" (Sent to ")[0];
                const string delBroadcastSql = "DELETE FROM notifications WHERE title = @origTitle AND message = @msg";
                await using var bCmd = new NpgsqlCommand(delBroadcastSql, conn);
                bCmd.Parameters.AddWithValue("origTitle", origTitle);
                bCmd.Parameters.AddWithValue("msg", notifMessage);
                await bCmd.ExecuteNonQueryAsync();
            }

            return Ok(new { id, deleted = true });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DeleteNotification Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to delete notification: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/settings - Load system settings from PostgreSQL 'system_settings'
    // -------------------------------------------------------------------------
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            const string sql = @"
                SELECT academic_year, semester, renewal_open, TO_CHAR(deadline, 'YYYY-MM-DD'), default_password
                FROM system_settings
                WHERE id = 1";

            await using var cmd = new NpgsqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return Ok(new SystemSettingsDto
                {
                    AcademicYear = reader.GetString(0),
                    Semester = reader.GetString(1),
                    RenewalOpen = reader.GetBoolean(2),
                    Deadline = reader.GetString(3),
                    DefaultPassword = reader.GetString(4)
                });
            }

            return Ok(new SystemSettingsDto());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetSettings Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to load settings: {ex.Message}" });
        }
    }

    // -------------------------------------------------------------------------
    // PUT /api/settings - Update system settings in PostgreSQL 'system_settings'
    // -------------------------------------------------------------------------
    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] SystemSettingsDto req)
    {
        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            const string sql = @"
                INSERT INTO system_settings (id, academic_year, semester, renewal_open, deadline, default_password)
                VALUES (1, @year, @sem, @open, CAST(@deadline AS DATE), @pwd)
                ON CONFLICT (id) DO UPDATE SET
                    academic_year = EXCLUDED.academic_year,
                    semester = EXCLUDED.semester,
                    renewal_open = EXCLUDED.renewal_open,
                    deadline = EXCLUDED.deadline,
                    default_password = EXCLUDED.default_password;";

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("year", req.AcademicYear);
            cmd.Parameters.AddWithValue("sem", req.Semester);
            cmd.Parameters.AddWithValue("open", req.RenewalOpen);
            cmd.Parameters.AddWithValue("deadline", string.IsNullOrWhiteSpace(req.Deadline) ? "2026-11-30" : req.Deadline);
            cmd.Parameters.AddWithValue("pwd", string.IsNullOrWhiteSpace(req.DefaultPassword) ? "123456" : req.DefaultPassword);

            await cmd.ExecuteNonQueryAsync();
            return Ok(req);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UpdateSettings Error] {ex.Message}");
            return StatusCode(500, new { error = $"Failed to save settings: {ex.Message}" });
        }
    }
}
