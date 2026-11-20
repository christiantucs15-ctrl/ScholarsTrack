using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace ScholarsTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RenewalsController : ControllerBase
{
    private readonly string _connectionString;

    public RenewalsController(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection is not configured.");
    }

    public class CreateRenewalRequest
    {
        public string ScholarId { get; set; } = string.Empty;
        public string ScholarName { get; set; } = string.Empty;
        public string Period { get; set; } = string.Empty;
        public string? Remarks { get; set; }
    }

    public class ApproveRenewalRequest
    {
        public string? Remarks { get; set; }
    }

    // GET /api/renewals?scholarId=2026-0001
    [HttpGet]
    public async Task<IActionResult> GetRenewals([FromQuery] string? scholarId)
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var hasScholarId = !string.IsNullOrWhiteSpace(scholarId);
        var sql = hasScholarId
            ? @"SELECT id, scholar_id, scholar_name, period, submitted_on, status, remarks
                FROM renewals
                WHERE scholar_id = @scholarId
                ORDER BY id DESC;"
            : @"SELECT id, scholar_id, scholar_name, period, submitted_on, status, remarks
                FROM renewals
                ORDER BY id DESC;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        if (hasScholarId)
        {
            cmd.Parameters.AddWithValue("@scholarId", scholarId!.Trim());
        }

        var list = new List<object>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            list.Add(new
            {
                id = reader.GetInt32(0),
                scholarId = reader.IsDBNull(1) ? "" : reader.GetString(1),
                scholarName = reader.IsDBNull(2) ? "" : reader.GetString(2),
                period = reader.IsDBNull(3) ? "" : reader.GetString(3),
                submittedOn = reader.IsDBNull(4) ? "" : reader.GetDateTime(4).ToString("yyyy-MM-dd"),
                status = reader.IsDBNull(5) ? "Under Review" : reader.GetString(5),
                remarks = reader.IsDBNull(6) ? "" : reader.GetString(6)
            });
        }

        return Ok(list);
    }

    // POST /api/renewals
    [HttpPost]
    public async Task<IActionResult> CreateRenewal([FromBody] CreateRenewalRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ScholarId) || string.IsNullOrWhiteSpace(request.Period))
        {
            return BadRequest(new { message = "ScholarId and Period are required." });
        }

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        const string sql = @"
            INSERT INTO renewals (scholar_id, scholar_name, period, submitted_on, status, remarks, updated_at)
            VALUES (@scholarId, @scholarName, @period, CURRENT_DATE, 'Under Review', @remarks, NOW())
            RETURNING id, scholar_id, scholar_name, period, submitted_on, status, remarks;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@scholarId", request.ScholarId.Trim());
        cmd.Parameters.AddWithValue("@scholarName", request.ScholarName.Trim());
        cmd.Parameters.AddWithValue("@period", request.Period.Trim());
        cmd.Parameters.AddWithValue(
            "@remarks",
            string.IsNullOrWhiteSpace(request.Remarks) ? "Submitted for staff evaluation." : request.Remarks.Trim()
        );

        await using var reader = await cmd.ExecuteReaderAsync();
        await reader.ReadAsync();

        return CreatedAtAction(nameof(GetRenewals), new { scholarId = request.ScholarId }, new
        {
            id = reader.GetInt32(0),
            scholarId = reader.GetString(1),
            scholarName = reader.GetString(2),
            period = reader.GetString(3),
            submittedOn = reader.GetDateTime(4).ToString("yyyy-MM-dd"),
            status = reader.GetString(5),
            remarks = reader.GetString(6)
        });
    }

    // PATCH /api/renewals/{id}/approve
    [HttpPatch("{id:int}/approve")]
    public async Task<IActionResult> ApproveRenewal(int id, [FromBody] ApproveRenewalRequest? request)
    {
        var remarks = string.IsNullOrWhiteSpace(request?.Remarks)
            ? "Documents already approved by staff."
            : request.Remarks.Trim();

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        const string sql = @"
            UPDATE renewals
            SET status = 'Approved',
                remarks = @remarks,
                updated_at = NOW()
            WHERE id = @id
            RETURNING id, scholar_id, scholar_name, period, submitted_on, status, remarks;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@remarks", remarks);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return NotFound(new { message = "Renewal record not found." });
        }

        return Ok(new
        {
            id = reader.GetInt32(0),
            scholarId = reader.GetString(1),
            scholarName = reader.GetString(2),
            period = reader.GetString(3),
            submittedOn = reader.GetDateTime(4).ToString("yyyy-MM-dd"),
            status = reader.GetString(5),
            remarks = reader.GetString(6)
        });
    }
}