using System.Data;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class AppRoleRepository : IAppRoleRepository
{
    private readonly IDbConnectionFactory _factory;

    public AppRoleRepository(IDbConnectionFactory factory) => _factory = factory;

    // Shared SELECT for list/view. UserCount is a correlated subquery over the AppUserRole n-n table.
    private const string SelectList = @"
SELECT r.pkid           AS Pkid,
       r.RoleId         AS RoleId,
       r.RoleName       AS RoleName,
       r.PermissionLevel AS PermissionLevel,
       r.Description     AS Description,
       (SELECT COUNT(*) FROM AppUserRole ur WHERE ur.RoleId = r.RoleId) AS UserCount
FROM AppRole r";

    public async Task<IEnumerable<AppRole>> GetAllAsync(CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<AppRole>(
            new CommandDefinition($"{SelectList} ORDER BY r.RoleId ASC", cancellationToken: ct));
    }

    public async Task<IEnumerable<AppRole>> QueryAsync(AppRoleQuery query, CancellationToken ct = default)
    {
        var sql = $@"{SelectList}
WHERE (@Keyword IS NULL
        OR r.RoleId LIKE @KeywordLike
        OR r.RoleName LIKE @KeywordLike
        OR r.Description LIKE @KeywordLike)
  AND (@PermissionLevelFrom IS NULL OR r.PermissionLevel >= @PermissionLevelFrom)
  AND (@PermissionLevelTo   IS NULL OR r.PermissionLevel <= @PermissionLevelTo)
ORDER BY r.RoleId ASC";

        var keyword = string.IsNullOrWhiteSpace(query.Keyword) ? null : query.Keyword.Trim();
        var parameters = new
        {
            Keyword = keyword,
            KeywordLike = keyword is null ? null : $"%{keyword}%",
            query.PermissionLevelFrom,
            query.PermissionLevelTo
        };

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<AppRole>(new CommandDefinition(sql, parameters, cancellationToken: ct));
    }

    public async Task<AppRole?> GetByIdAsync(string roleId, CancellationToken ct = default)
    {
        var sql = $@"{SelectList} WHERE r.RoleId = @RoleId;
SELECT ur.UserId FROM AppUserRole ur WHERE ur.RoleId = @RoleId ORDER BY ur.UserId;";

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var multi = await conn.QueryMultipleAsync(
            new CommandDefinition(sql, new { RoleId = roleId }, cancellationToken: ct));

        var role = await multi.ReadFirstOrDefaultAsync<AppRole>();
        if (role is null) return null;

        role.UserIds = (await multi.ReadAsync<string>()).ToList();
        return role;
    }

    public async Task<bool> ExistsAsync(string roleId, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        var count = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(1) FROM AppRole WHERE RoleId = @RoleId",
            new { RoleId = roleId }, cancellationToken: ct));
        return count > 0;
    }

    public async Task<string> CreateAsync(AppRoleRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync(new CommandDefinition(@"
INSERT INTO AppRole (RoleId, RoleName, PermissionLevel, Description)
VALUES (@RoleId, @RoleName, @PermissionLevel, @Description);",
            new { request.RoleId, request.RoleName, request.PermissionLevel, request.Description },
            tx, cancellationToken: ct));

        await SyncUsersAsync(conn, tx, request.RoleId, request.UserIds, ct);

        tx.Commit();
        return request.RoleId;
    }

    public async Task<bool> UpdateAsync(AppRoleRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        var affected = await conn.ExecuteAsync(new CommandDefinition(@"
UPDATE AppRole
SET RoleName = @RoleName,
    PermissionLevel = @PermissionLevel,
    Description = @Description
WHERE RoleId = @RoleId;",
            new { request.RoleId, request.RoleName, request.PermissionLevel, request.Description },
            tx, cancellationToken: ct));

        if (affected == 0)
        {
            tx.Rollback();
            return false;
        }

        await SyncUsersAsync(conn, tx, request.RoleId, request.UserIds, ct);

        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(string roleId, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // Remove n-n rows first to satisfy the FK_AppUserRole_AppRole constraint.
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM AppUserRole WHERE RoleId = @RoleId",
            new { RoleId = roleId }, tx, cancellationToken: ct));

        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM AppRole WHERE RoleId = @RoleId",
            new { RoleId = roleId }, tx, cancellationToken: ct));

        tx.Commit();
        return affected > 0;
    }

    // Delete-then-reinsert the AppUserRole assignments for a role.
    private static async Task SyncUsersAsync(
        IDbConnection conn, IDbTransaction tx, string roleId, List<string> userIds, CancellationToken ct)
    {
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM AppUserRole WHERE RoleId = @RoleId",
            new { RoleId = roleId }, tx, cancellationToken: ct));

        var distinct = userIds
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u.Trim())
            .Distinct()
            .ToList();

        if (distinct.Count == 0) return;

        await conn.ExecuteAsync(new CommandDefinition(
            "INSERT INTO AppUserRole (UserId, RoleId) VALUES (@UserId, @RoleId)",
            distinct.Select(u => new { UserId = u, RoleId = roleId }),
            tx, cancellationToken: ct));
    }
}
