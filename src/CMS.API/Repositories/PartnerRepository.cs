using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class PartnerRepository : IPartnerRepository
{
    private readonly IDbConnectionFactory _factory;

    public PartnerRepository(IDbConnectionFactory factory) => _factory = factory;

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
        return await conn.QueryFirstOrDefaultAsync<Partner>(new CommandDefinition(
            $"{SelectList} WHERE p.pkid = @Pkid", new { Pkid = pkid }, cancellationToken: ct));
    }

    public async Task<short> CreateAsync(PartnerRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);

        // pkid is IDENTITY — omit from the column list; return the DB-assigned value.
        return await conn.ExecuteScalarAsync<short>(new CommandDefinition(@"
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
            cancellationToken: ct));
    }

    public async Task<bool> UpdateAsync(PartnerRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);

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
            cancellationToken: ct));

        return affected > 0;
    }

    public async Task<bool> DeleteAsync(short pkid, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Partner WHERE pkid = @Pkid",
            new { Pkid = pkid }, cancellationToken: ct));
        return affected > 0;
    }
}
