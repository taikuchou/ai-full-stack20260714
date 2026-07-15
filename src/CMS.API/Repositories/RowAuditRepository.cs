using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class RowAuditRepository : IRowAuditRepository
{
    private readonly IDbConnectionFactory _factory;

    public RowAuditRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<IEnumerable<RowAuditHistoryItem>> GetForRecordAsync(
        string tableName, string pkid, CancellationToken ct = default)
    {
        // pkid (IDENTITY) breaks ties within the same millisecond, so bulk changes stay in the order
        // they were actually written rather than an arbitrary one.
        const string sql = @"
SELECT [DateTime]  AS [DateTime],
       UserName    AS UserName,
       ActionType  AS ActionType,
       ActionDesc  AS ActionDesc
FROM RowAudit
WHERE TableName = @TableName
  AND PrimaryKeyValues = @Pkid
ORDER BY [DateTime] DESC, pkid DESC";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<RowAuditHistoryItem>(
            new CommandDefinition(sql, new { TableName = tableName, Pkid = pkid }, cancellationToken: ct));
    }
}
