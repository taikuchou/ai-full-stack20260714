using System.Data;

namespace CMS.API.Auditing;

/// <summary>
/// Writes a single RowAudit row describing a change to any business table. Repositories call this
/// after a successful Insert / Update / Delete.
/// <para>
/// Every method takes the caller's open connection and transaction so the audit row is written
/// inside the same transaction as the change it describes: a rolled-back or failed change leaves no
/// audit row behind, and neither can commit without the other.
/// </para>
/// </summary>
public interface IRowAuditWriter
{
    /// <param name="tableName">The audited table, e.g. "Course".</param>
    /// <param name="entity">The inserted row, re-read so its DB-assigned pkid is populated; its
    /// first string property becomes ActionDesc.</param>
    Task LogInsertAsync<T>(
        IDbConnection conn, IDbTransaction tx, string tableName, T entity, CancellationToken ct = default)
        where T : notnull;

    /// <summary>
    /// Records the names of the properties that differ between <paramref name="before"/> and
    /// <paramref name="after"/>. An update that changed nothing writes no row.
    /// </summary>
    Task LogUpdateAsync<T>(
        IDbConnection conn, IDbTransaction tx, string tableName, T before, T after, CancellationToken ct = default)
        where T : notnull;

    /// <param name="entity">The row as it looked before deletion, loaded inside the same
    /// transaction; its first string property becomes ActionDesc.</param>
    Task LogDeleteAsync<T>(
        IDbConnection conn, IDbTransaction tx, string tableName, T entity, CancellationToken ct = default)
        where T : notnull;
}
