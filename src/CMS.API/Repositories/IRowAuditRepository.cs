using CMS.API.Models;

namespace CMS.API.Repositories;

/// <summary>Reads back the audit trail written by <see cref="Auditing.IRowAuditWriter"/>.</summary>
public interface IRowAuditRepository
{
    /// <param name="tableName">The audited table, e.g. "Course".</param>
    /// <param name="pkid">The record's pkid, as stored in RowAudit.PrimaryKeyValues.</param>
    /// <returns>The record's history, newest first; empty when it has never been changed.</returns>
    Task<IEnumerable<RowAuditHistoryItem>> GetForRecordAsync(
        string tableName, string pkid, CancellationToken ct = default);
}
