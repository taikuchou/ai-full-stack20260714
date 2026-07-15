namespace CMS.API.Models;

/// <summary>
/// One entry of a record's audit trail, as returned by <c>GET /api/rowaudit</c>. The RowAudit
/// identity key and the TableName/PrimaryKeyValues used to look it up are omitted — the caller
/// already knows which record it asked about.
/// </summary>
public class RowAuditHistoryItem
{
    /// <summary>
    /// When the change happened, in UTC (the writer stamps <c>DateTime.UtcNow</c>). The column is a
    /// plain <c>datetime</c> and so carries no offset: clients must treat this as UTC and convert
    /// for display, or a UTC+8 reader sees times eight hours early.
    /// </summary>
    public DateTime DateTime { get; set; }

    /// <summary>The signed-in user who made the change, or "system".</summary>
    public string UserName { get; set; } = string.Empty;

    /// <summary>"Insert" | "Update" | "Delete".</summary>
    public string ActionType { get; set; } = string.Empty;

    /// <summary>First string column (Insert/Delete) or the changed column names (Update).</summary>
    public string? ActionDesc { get; set; }
}
