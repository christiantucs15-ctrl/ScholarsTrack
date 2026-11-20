namespace ScholarsTrack.Api.Models;

// =============================================================================
// Data Transfer Objects (DTOs) for the ScholarsTrack C# API
// These C# classes define the structure of JSON data sent between React and C#.
// =============================================================================

/// <summary>
/// Used by POST /api/auth/login when a Scholar or Admin logs in.
/// </summary>
public class LoginRequest
{
    public string ScholarId { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

/// <summary>
/// Used by PUT /api/auth/change-password when a Scholar updates their password.
/// </summary>
public class ChangePasswordRequest
{
    public string ScholarId { get; set; } = string.Empty;
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

/// <summary>
/// Used by POST /api/auth/forgot-password when a Scholar requests a password reset from Admin.
/// </summary>
public class ForgotPasswordRequest
{
    public string ScholarId { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

/// <summary>
/// Used by POST /api/auth/reset-password when Admin resets a Scholar's password back to default.
/// </summary>
public class AdminResetPasswordRequest
{
    public string ScholarId { get; set; } = string.Empty;
}

/// <summary>
/// Represents a Scholar's profile returned from the PostgreSQL 'scholars' table.
/// </summary>
public class ScholarDto
{
    public string ScholarId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string School { get; set; } = string.Empty;
    public string Barangay { get; set; } = string.Empty;
    public string Cluster { get; set; } = string.Empty;
    public string Course { get; set; } = string.Empty;
    public string YearLevel { get; set; } = string.Empty;
    public int ApplicantRank { get; set; } = 1;
    public string ScholarshipType { get; set; } = "Academic";
    public string RequiredGwa { get; set; } = "2.00";
    public string Status { get; set; } = "active";
}

/// <summary>
/// Used by POST /api/scholars when the Admin creates a new scholar account.
/// </summary>
public class CreateScholarRequest
{
    public string ScholarId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? ContactNumber { get; set; }
    public string? School { get; set; }
    public string Barangay { get; set; } = string.Empty;
    public string? Course { get; set; }
    public string? YearLevel { get; set; }
    public int? ApplicantRank { get; set; }
}

/// <summary>
/// Represents a semester renewal application from the 'renewals' table.
/// </summary>
public class RenewalDto
{
    public int Id { get; set; }
    public string ScholarId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Barangay { get; set; } = string.Empty;
    public string Cluster { get; set; } = string.Empty;
    public int ApplicantRank { get; set; } = 1;
    public string ScholarshipType { get; set; } = "Academic";
    public string RequiredGwa { get; set; } = "2.00";
    public string Period { get; set; } = string.Empty;
    public string SubmittedOn { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Remarks { get; set; }
}

/// <summary>
/// Used by PUT /api/renewals/{id}/status when Admin approves or rejects a renewal.
/// </summary>
public class UpdateRenewalStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? Remarks { get; set; }
}

/// <summary>
/// Represents an SDP Activity from the 'sdp_activities' table.
/// </summary>
public class SdpActivityDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string TargetDate { get; set; } = string.Empty;
    public string Cluster { get; set; } = "All Clusters";
    public string TargetYearLevel { get; set; } = "All Years";
    public int ExpectedHours { get; set; } = 4;
    public int CompletedCount { get; set; }
    public int TotalExpected { get; set; }
    public string Status { get; set; } = "upcoming";
    public string? TimeIn { get; set; }
    public string? TimeOut { get; set; }
    public bool ScholarCompleted { get; set; }
}

/// <summary>
/// Used by POST /api/sdp when Admin schedules a new SDP activity.
/// </summary>
public class CreateSdpRequest
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "Community Service";
    public string TargetDate { get; set; } = string.Empty;
    public string? Cluster { get; set; }
    public string? TargetYearLevel { get; set; }
    public int TotalExpected { get; set; } = 35;
}

/// <summary>
/// Used by POST /api/sdp/{id}/attendance to mark a scholar's SDP attendance in 'sdp_completions'.
/// </summary>
public class ToggleSdpAttendanceRequest
{
    public string ScholarId { get; set; } = string.Empty;
    public bool Completed { get; set; }
}

/// <summary>
/// Used by POST /api/sdp/{id}/scan-qr when Staff/Evaluator scans a Scholar's Profile QR Code
/// for Time-In or Time-Out at an SDP Activity.
/// </summary>
public class ScanSdpQrRequest
{
    public string QrValue { get; set; } = string.Empty;
    public string Mode { get; set; } = "time_in"; // "time_in" or "time_out"
    public string? StaffUsername { get; set; }
}

/// <summary>
/// Represents an uploaded requirement file from the 'renewal_documents' table.
/// </summary>
public class DocumentDto
{
    public int Id { get; set; }
    public int RenewalId { get; set; }
    public string ScholarId { get; set; } = string.Empty;
    public string ScholarName { get; set; } = string.Empty;
    public string YearLevel { get; set; } = string.Empty;
    public string Cluster { get; set; } = string.Empty;
    public string Period { get; set; } = string.Empty;
    public string DocType { get; set; } = string.Empty;
    public string File { get; set; } = string.Empty;
    public string Size { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
}

/// <summary>
/// Used by PUT /api/documents/{id}/status when Admin verifies or rejects a document.
/// </summary>
public class UpdateDocStatusRequest
{
    public string Status { get; set; } = "verified";
}

/// <summary>
/// Represents a single uploaded document item inside a renewal submission.
/// </summary>
public class SubmittedDocItem
{
    public string DocType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public int FileSizeKb { get; set; } = 1024;
}

/// <summary>
/// Used by POST /api/renewals when a scholar submits their semester renewal.
/// </summary>
public class SubmitRenewalRequest
{
    public string ScholarId { get; set; } = string.Empty;
    public string? Name { get; set; }
    public string? AcademicYear { get; set; }
    public string? Semester { get; set; }
    public string Status { get; set; } = "under_review";
    public List<SubmittedDocItem> Documents { get; set; } = new();
}

/// <summary>
/// Used by POST /api/grades when a student manually inputs a subject, units, and grade for a semester.
/// </summary>
public class CreateGradeRequest
{
    public string ScholarId { get; set; } = string.Empty;
    public string? Name { get; set; }
    public string Period { get; set; } = "1st Semester, 2026-2027";
    public string Code { get; set; } = string.Empty;
    public string SubjectName { get; set; } = string.Empty;
    public int Units { get; set; } = 3;
    public string Grade { get; set; } = "1.50";
}

/// <summary>
/// Represents a single subject grade from the 'grades' table.
/// </summary>
public class GradeSubjectDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Units { get; set; } = 3;
    public string Grade { get; set; } = "1.50";
    public string Remarks { get; set; } = "passed";
}

/// <summary>
/// Groups a scholar's subjects by semester period along with computed GWA and total units.
/// </summary>
public class SemesterGradesDto
{
    public string Period { get; set; } = string.Empty;
    public string Gwa { get; set; } = "1.50";
    public int Units { get; set; }
    public string Status { get; set; } = "passed";
    public List<GradeSubjectDto> Subjects { get; set; } = new();
}

/// <summary>
/// Represents a system or scholar notification from the 'notifications' table.
/// </summary>
public class NotificationDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Type { get; set; } = "info";
    public bool Read { get; set; }
}

/// <summary>
/// Used by POST /api/notifications when Admin creates an announcement or notification.
/// </summary>
public class CreateNotificationRequest
{
    public string RecipientRole { get; set; } = "student";
    public string? ScholarId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = "info";
}

/// <summary>
/// Represents the active scholarship settings from the 'system_settings' table.
/// </summary>
public class SystemSettingsDto
{
    public string AcademicYear { get; set; } = "2026-2027";
    public string Semester { get; set; } = "1st Semester";
    public bool RenewalOpen { get; set; } = true;
    public string Deadline { get; set; } = "2026-11-30";
    public string DefaultPassword { get; set; } = "123456";
}

/// <summary>
/// Represents a geographic Cluster (A to G), its 5 barangays, and live scholar count.
/// </summary>
public class ClusterDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int ScholarCount { get; set; }
    public List<string> Barangays { get; set; } = new();
}

/// <summary>
/// Represents an Evaluator / Staff account from the 'evaluators' table.
/// </summary>
public class EvaluatorDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Department { get; set; } = "Scholarship Evaluation Office";
}

/// <summary>
/// Used by POST /api/evaluators when Admin creates a new Evaluator / Staff account.
/// </summary>
public class CreateEvaluatorRequest
{
    public string Username { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Department { get; set; }
}
