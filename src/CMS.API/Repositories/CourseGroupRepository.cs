using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class CourseGroupRepository : ICourseGroupRepository
{
    private readonly IDbConnectionFactory _factory;

    public CourseGroupRepository(IDbConnectionFactory factory) => _factory = factory;

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
        return await conn.QueryFirstOrDefaultAsync<CourseGroup>(new CommandDefinition(
            $"{SelectList} WHERE g.pkid = @Pkid", new { Pkid = pkid }, cancellationToken: ct));
    }

    public async Task<short> CreateAsync(CourseGroupRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);

        // pkid is IDENTITY — omit from the column list; return the DB-assigned value.
        return await conn.ExecuteScalarAsync<short>(new CommandDefinition(@"
INSERT INTO CourseGroup (Description)
VALUES (@Description);
SELECT CAST(SCOPE_IDENTITY() AS smallint);",
            new { request.Description },
            cancellationToken: ct));
    }

    public async Task<bool> UpdateAsync(CourseGroupRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);

        var affected = await conn.ExecuteAsync(new CommandDefinition(@"
UPDATE CourseGroup
SET Description = @Description
WHERE pkid = @Pkid;",
            new { request.Pkid, request.Description },
            cancellationToken: ct));

        return affected > 0;
    }

    public async Task<bool> DeleteAsync(short pkid, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM CourseGroup WHERE pkid = @Pkid",
            new { Pkid = pkid }, cancellationToken: ct));
        return affected > 0;
    }
}
