using System.Data;
using CMS.API.Auditing;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class PartnerRepository : IPartnerRepository
{
    private const string TableName = "Partner";

    private readonly IDbConnectionFactory _factory;
    private readonly IRowAuditWriter _audit;

    public PartnerRepository(IDbConnectionFactory factory, IRowAuditWriter audit)
    {
        _factory = factory;
        _audit = audit;
    }

    // Shared SELECT for list/view. No JOINs (no FKs), no RTRIM (no nchar columns).
    private const string SelectList = @"
SELECT p.pkid                   AS Pkid,
       p.Name                    AS Name,
       p.AppKey                  AS AppKey,
       p.NameOnPartnerMenu       AS NameOnPartnerMenu,
       p.NameOnCourseDetailPage  AS NameOnCourseDetailPage,
       p.DisplayOrder            AS DisplayOrder,
       p.ImageFilename           AS ImageFilename
FROM Partner p";

    public async Task<IEnumerable<Partner>> GetAllAsync(CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<Partner>(
            new CommandDefinition($"{SelectList} ORDER BY p.DisplayOrder ASC", cancellationToken: ct));
    }

    public async Task<IEnumerable<Partner>> QueryAsync(PartnerQuery query, CancellationToken ct = default)
    {
        var sql = $@"{SelectList}
WHERE (@Keyword IS NULL
        OR p.Name LIKE @KeywordLike
        OR p.AppKey LIKE @KeywordLike
        OR p.NameOnPartnerMenu LIKE @KeywordLike
        OR p.NameOnCourseDetailPage LIKE @KeywordLike)
  AND (@DisplayOrderFrom IS NULL OR p.DisplayOrder >= @DisplayOrderFrom)
  AND (@DisplayOrderTo   IS NULL OR p.DisplayOrder <= @DisplayOrderTo)
ORDER BY p.DisplayOrder ASC";

        var keyword = string.IsNullOrWhiteSpace(query.Keyword) ? null : query.Keyword.Trim();
        var parameters = new
        {
            Keyword = keyword,
            KeywordLike = keyword is null ? null : $"%{keyword}%",
            query.DisplayOrderFrom,
            query.DisplayOrderTo
        };

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<Partner>(new CommandDefinition(sql, parameters, cancellationToken: ct));
    }

    public async Task<Partner?> GetByIdAsync(short pkid, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await LoadAsync(conn, null, pkid, ct);
    }

    public async Task<short> CreateAsync(PartnerRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // pkid is IDENTITY — omit from the column list; return the DB-assigned value.
        var newId = await conn.ExecuteScalarAsync<short>(new CommandDefinition(@"
INSERT INTO Partner (Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage, DisplayOrder, ImageFilename)
VALUES (@Name, @AppKey, @NameOnPartnerMenu, @NameOnCourseDetailPage, @DisplayOrder, @ImageFilename);
SELECT CAST(SCOPE_IDENTITY() AS smallint);",
            new
            {
                request.Name,
                request.AppKey,
                request.NameOnPartnerMenu,
                request.NameOnCourseDetailPage,
                request.DisplayOrder,
                request.ImageFilename
            },
            tx, cancellationToken: ct));

        await _audit.LogInsertAsync(conn, tx, TableName, await RequireAsync(conn, tx, newId, ct), ct);

        tx.Commit();
        return newId;
    }

    public async Task<bool> UpdateAsync(PartnerRequest request, CancellationToken ct = default)
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
UPDATE Partner
SET Name = @Name,
    AppKey = @AppKey,
    NameOnPartnerMenu = @NameOnPartnerMenu,
    NameOnCourseDetailPage = @NameOnCourseDetailPage,
    DisplayOrder = @DisplayOrder,
    ImageFilename = @ImageFilename
WHERE pkid = @Pkid;",
            new
            {
                request.Pkid,
                request.Name,
                request.AppKey,
                request.NameOnPartnerMenu,
                request.NameOnCourseDetailPage,
                request.DisplayOrder,
                request.ImageFilename
            },
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
            "DELETE FROM Partner WHERE pkid = @Pkid",
            new { Pkid = pkid }, tx, cancellationToken: ct));

        await _audit.LogDeleteAsync(conn, tx, TableName, row, ct);

        tx.Commit();
        return true;
    }

    private static Task<Partner?> LoadAsync(
        IDbConnection conn, IDbTransaction? tx, short pkid, CancellationToken ct)
        => conn.QueryFirstOrDefaultAsync<Partner>(new CommandDefinition(
            $"{SelectList} WHERE p.pkid = @Pkid", new { Pkid = pkid }, tx, cancellationToken: ct));

    /// <summary>Loads a row that must exist because the caller just wrote it inside this transaction.</summary>
    private static async Task<Partner> RequireAsync(
        IDbConnection conn, IDbTransaction tx, short pkid, CancellationToken ct)
        => await LoadAsync(conn, tx, pkid, ct)
           ?? throw new InvalidOperationException($"{TableName} {pkid} is missing immediately after being written.");
}
