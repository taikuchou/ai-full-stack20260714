namespace CMS.API.Auditing;

/// <summary>
/// One row destined for the RowAudit table. <c>pkid</c> is IDENTITY and so is not represented here.
/// </summary>
/// <param name="Timestamp">Maps to the <c>[DateTime]</c> column, named apart from it to avoid
/// shadowing <see cref="System.DateTime"/>.</param>
public sealed record RowAuditEntry(
    string TableName,
    string UserName,
    string PrimaryKeyValues,
    string ActionType,
    string ActionDesc,
    DateTime Timestamp);
