using System.Data;
using CMS.API.Auditing;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class CourseGroupRepository : ICourseGroupRepository
{
    private const string TableName = "CourseGroup";

    private readonly IDbConnectionFactory _factory;
    private readonly IRowAuditWriter _audit;

    public CourseGroupRepository(IDbConnectionFactory factory, IRowAuditWriter audit)
    {
        _factory = factory;
        _audit = audit;
    }

    // Shared SELECT for list/view. No JOINs (no FKs), no RTRIM (no nchar columns).
    private const string SelectList = @"
SELECT g.pkid        AS Pkid,
       g.Description  AS Description
FROM CourseGroup g";

    public async Task<IEnumerable<CourseGroup>> GetAllAsync(CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<CourseGroup>(
            new CommandDefinition($"{SelectList} ORDER BY g.pkid ASC", cancellationToken: ct));
    }

    public async Task<IEnumerable<CourseGroup>> QueryAsync(CourseGroupQuery query, CancellationToken ct = default)
    {
        var sql = $@"{SelectList}
WHERE (@Keyword IS NULL OR g.Description LIKE @KeywordLike)
ORDER BY g.pkid ASC";

        var keyword = string.IsNullOrWhiteSpace(query.Keyword) ? null : query.Keyword.Trim();
        var parameters = new
        {
            Keyword = keyword,
            KeywordLike = keyword is null ? null : $"%{keyword}%"
        };

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<CourseGroup>(new CommandDefinition(sql, parameters, cancellationToken: ct));
    }

    public async Task<CourseGroup?> GetByIdAsync(short pkid, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await LoadAsync(conn, null, pkid, ct);
    }

    public async Task<short> CreateAsync(CourseGroupRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // pkid is IDENTITY — omit from the column list; return the DB-assigned value.
        var newId = await conn.ExecuteScalarAsync<short>(new CommandDefinition(@"
INSERT INTO CourseGroup (Description)
VALUES (@Description);
SELECT CAST(SCOPE_IDENTITY() AS smallint);",
            new { request.Description },
            tx, cancellationToken: ct));

        await _audit.LogInsertAsync(conn, tx, TableName, await RequireAsync(conn, tx, newId, ct), ct);

        tx.Commit();
        return newId;
    }

    public async Task<bool> UpdateAsync(CourseGroupRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // Read the "before" inside the transaction so the audited change list is accurate.
        var before = await LoadAsync(conn, tx, request.Pkid, ct);
        if (before is null)
        {
            tx.Rollback();
            return false;
        }

        var affected = await conn.ExecuteAsync(new CommandDefinition(@"
UPDATE CourseGroup
SET Description = @Description
WHERE pkid = @Pkid;",
            new { request.Pkid, request.Description },
            tx, cancellationToken: ct));

        if (affected == 0)
        {
            tx.Rollback();
            return false;
        }

        await _audit.LogUpdateAsync(
            conn, tx, TableName, before, await RequireAsync(conn, tx, request.Pkid, ct), ct);

        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(short pkid, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // Read the row before deleting it — afterwards its first string column is gone.
        var row = await LoadAsync(conn, tx, pkid, ct);
        if (row is null)
        {
            tx.Rollback();
            return false;
        }

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM CourseGroup WHERE pkid = @Pkid",
            new { Pkid = pkid }, tx, cancellationToken: ct));

        await _audit.LogDeleteAsync(conn, tx, TableName, row, ct);

        tx.Commit();
        return true;
    }

    private static Task<CourseGroup?> LoadAsync(
        IDbConnection conn, IDbTransaction? tx, short pkid, CancellationToken ct)
        => conn.QueryFirstOrDefaultAsync<CourseGroup>(new CommandDefinition(
            $"{SelectList} WHERE g.pkid = @Pkid", new { Pkid = pkid }, tx, cancellationToken: ct));

    /// <summary>Loads a row that must exist because the caller just wrote it inside this transaction.</summary>
    private static async Task<CourseGroup> RequireAsync(
        IDbConnection conn, IDbTransaction tx, short pkid, CancellationToken ct)
        => await LoadAsync(conn, tx, pkid, ct)
           ?? throw new InvalidOperationException($"{TableName} {pkid} is missing immediately after being written.");
}
