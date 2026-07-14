using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class PublishStatusRepository : IPublishStatusRepository
{
    private readonly IDbConnectionFactory _factory;

    public PublishStatusRepository(IDbConnectionFactory factory) => _factory = factory;

    // Shared SELECT for list/view. No JOINs (no FKs), no RTRIM (no nchar columns).
    private const string SelectList = @"
SELECT s.pkid            AS Pkid,
       s.Description      AS Description,
       s.IsDraft          AS IsDraft,
       s.IsPublished      AS IsPublished,
       s.IsDiscontinued   AS IsDiscontinued
FROM PublishStatus s";

    public async Task<IEnumerable<PublishStatus>> GetAllAsync(CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<PublishStatus>(
            new CommandDefinition($"{SelectList} ORDER BY s.pkid ASC", cancellationToken: ct));
    }

    public async Task<IEnumerable<PublishStatus>> QueryAsync(PublishStatusQuery query, CancellationToken ct = default)
    {
        var sql = $@"{SelectList}
WHERE (@Keyword IS NULL OR s.Description LIKE @KeywordLike)
  AND (@IsDraft        IS NULL OR s.IsDraft        = @IsDraft)
  AND (@IsPublished    IS NULL OR s.IsPublished    = @IsPublished)
  AND (@IsDiscontinued IS NULL OR s.IsDiscontinued = @IsDiscontinued)
ORDER BY s.pkid ASC";

        var keyword = string.IsNullOrWhiteSpace(query.Keyword) ? null : query.Keyword.Trim();
        var parameters = new
        {
            Keyword = keyword,
            KeywordLike = keyword is null ? null : $"%{keyword}%",
            query.IsDraft,
            query.IsPublished,
            query.IsDiscontinued
        };

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<PublishStatus>(new CommandDefinition(sql, parameters, cancellationToken: ct));
    }

    public async Task<PublishStatus?> GetByIdAsync(byte pkid, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryFirstOrDefaultAsync<PublishStatus>(new CommandDefinition(
            $"{SelectList} WHERE s.pkid = @Pkid", new { Pkid = pkid }, cancellationToken: ct));
    }

    public async Task<bool> ExistsAsync(byte pkid, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        var count = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(1) FROM PublishStatus WHERE pkid = @Pkid",
            new { Pkid = pkid }, cancellationToken: ct));
        return count > 0;
    }

    public async Task<byte> CreateAsync(PublishStatusRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);

        // pkid is user-assigned (tinyint, not IDENTITY) — include it in the column list; no SCOPE_IDENTITY.
        await conn.ExecuteAsync(new CommandDefinition(@"
INSERT INTO PublishStatus (pkid, Description, IsDraft, IsPublished, IsDiscontinued)
VALUES (@Pkid, @Description, @IsDraft, @IsPublished, @IsDiscontinued);",
            new { request.Pkid, request.Description, request.IsDraft, request.IsPublished, request.IsDiscontinued },
            cancellationToken: ct));

        return request.Pkid;
    }

    public async Task<bool> UpdateAsync(PublishStatusRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);

        var affected = await conn.ExecuteAsync(new CommandDefinition(@"
UPDATE PublishStatus
SET Description = @Description,
    IsDraft = @IsDraft,
    IsPublished = @IsPublished,
    IsDiscontinued = @IsDiscontinued
WHERE pkid = @Pkid;",
            new { request.Pkid, request.Description, request.IsDraft, request.IsPublished, request.IsDiscontinued },
            cancellationToken: ct));

        return affected > 0;
    }

    public async Task<bool> DeleteAsync(byte pkid, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM PublishStatus WHERE pkid = @Pkid",
            new { Pkid = pkid }, cancellationToken: ct));
        return affected > 0;
    }
}
