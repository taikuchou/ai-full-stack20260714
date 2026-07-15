using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class LookupRepository : ILookupRepository
{
    private readonly IDbConnectionFactory _factory;

    public LookupRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<IEnumerable<LookupItem>> GetAppUsersAsync(CancellationToken ct = default)
    {
        // Label mirrors the UI sample chips: "UserName (UserId)".
        const string sql = @"
SELECT UserId AS Id,
       (UserName + ' (' + UserId + ')') AS Label
FROM AppUser
ORDER BY UserName ASC";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<LookupItem>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<LookupItem>> GetAppRolesAsync(CancellationToken ct = default)
    {
        // Label mirrors the appusers lookup shape: "RoleName (RoleId)".
        const string sql = @"
SELECT RoleId AS Id,
       (RoleName + ' (' + RoleId + ')') AS Label
FROM AppRole
ORDER BY RoleName ASC";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<LookupItem>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<LookupItem>> GetPublishStatusesAsync(CancellationToken ct = default)
    {
        // Id is the tinyint pkid rendered as text so the LookupItem.Id (string) contract holds.
        const string sql = @"
SELECT CAST(pkid AS varchar(3)) AS Id,
       Description               AS Label
FROM PublishStatus
ORDER BY pkid ASC";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<LookupItem>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<LookupItem>> GetPartnersAsync(CancellationToken ct = default)
    {
        // Id is the smallint pkid rendered as text so the LookupItem.Id (string) contract holds.
        const string sql = @"
SELECT CAST(pkid AS varchar(6)) AS Id,
       Name                     AS Label
FROM Partner
ORDER BY DisplayOrder ASC";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<LookupItem>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<LookupItem>> GetCourseGroupsAsync(CancellationToken ct = default)
    {
        // Id is the smallint pkid rendered as text so the LookupItem.Id (string) contract holds.
        const string sql = @"
SELECT CAST(pkid AS varchar(6)) AS Id,
       Description              AS Label
FROM CourseGroup
ORDER BY pkid ASC";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<LookupItem>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<LookupItem>> GetCertificationsAsync(CancellationToken ct = default)
    {
        // Title is nchar(100) → RTRIM. Id is the int pkid rendered as text (LookupItem.Id is string).
        const string sql = @"
SELECT CAST(pkid AS varchar(10)) AS Id,
       RTRIM(Title)              AS Label
FROM Certification
ORDER BY pkid ASC";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<LookupItem>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<LookupItem>> GetJobCategoriesAsync(CancellationToken ct = default)
    {
        // Id is the smallint pkid rendered as text so the LookupItem.Id (string) contract holds.
        const string sql = @"
SELECT CAST(pkid AS varchar(6)) AS Id,
       Description             AS Label
FROM JobCategory
ORDER BY Description ASC";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<LookupItem>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<LookupItem>> GetTrainingCentersAsync(CancellationToken ct = default)
    {
        // Id is the smallint pkid rendered as text so the LookupItem.Id (string) contract holds.
        // DisplayOrder drives the left-to-right tab order on the FeaturedPromoItem grid.
        const string sql = @"
SELECT CAST(pkid AS varchar(6)) AS Id,
       Name                     AS Label
FROM TrainingCenter
ORDER BY DisplayOrder ASC";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<LookupItem>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<LookupItem>> GetPromoCodesAsync(CancellationToken ct = default)
    {
        // Id is the int pkid rendered as text so the LookupItem.Id (string) contract holds.
        const string sql = @"
SELECT CAST(pkid AS varchar(10)) AS Id,
       PromoCode                 AS Label
FROM Promotion2
ORDER BY PromoCode ASC";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<LookupItem>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<PromoCodeLookup?> GetPromoCodeAsync(string promoCode, CancellationToken ct = default)
    {
        const string sql = @"
SELECT pkid        AS Pkid,
       PromoCode   AS PromoCode,
       Topic       AS Topic,
       Description AS Description
FROM Promotion2
WHERE PromoCode = @PromoCode";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryFirstOrDefaultAsync<PromoCodeLookup>(
            new CommandDefinition(sql, new { PromoCode = promoCode }, cancellationToken: ct));
    }
}
