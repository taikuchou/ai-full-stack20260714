using System.Data;
using CMS.API.Auditing;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class AppRoleRepository : IAppRoleRepository
{
    private const string TableName = "AppRole";

    private readonly IDbConnectionFactory _factory;
    private readonly IRowAuditWriter _audit;

    public AppRoleRepository(IDbConnectionFactory factory, IRowAuditWriter audit)
    {
        _factory = factory;
        _audit = audit;
    }

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
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await LoadAsync(conn, null, roleId, ct);
    }

    /// <summary>
    /// Reads a role and its user links. Takes the caller's transaction so audit "before" snapshots
    /// see the same uncommitted state as the change itself.
    /// </summary>
    private static async Task<AppRole?> LoadAsync(
        IDbConnection conn, IDbTransaction? tx, string roleId, CancellationToken ct)
    {
        var sql = $@"{SelectList} WHERE r.RoleId = @RoleId;
SELECT ur.UserId FROM AppUserRole ur WHERE ur.RoleId = @RoleId ORDER BY ur.UserId;";

        using var multi = await conn.QueryMultipleAsync(
            new CommandDefinition(sql, new { RoleId = roleId }, tx, cancellationToken: ct));

        var role = await multi.ReadFirstOrDefaultAsync<AppRole>();
        if (role is null) return null;

        role.UserIds = (await multi.ReadAsync<string>()).ToList();
        return role;
    }

    /// <summary>Loads a row that must exist because the caller just wrote it inside this transaction.</summary>
    private static async Task<AppRole> RequireAsync(
        IDbConnection conn, IDbTransaction tx, string roleId, CancellationToken ct)
        => await LoadAsync(conn, tx, roleId, ct)
           ?? throw new InvalidOperationException($"{TableName} {roleId} is missing immediately after being written.");

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

        await _audit.LogInsertAsync(conn, tx, TableName, await RequireAsync(conn, tx, request.RoleId, ct), ct);

        tx.Commit();
        return request.RoleId;
    }

    public async Task<bool> UpdateAsync(AppRoleRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // Read the "before" inside the transaction so the audited change list is accurate.
        var before = await LoadAsync(conn, tx, request.RoleId, ct);
        if (before is null)
        {
            tx.Rollback();
            return false;
        }

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

        await _audit.LogUpdateAsync(
            conn, tx, TableName, before, await RequireAsync(conn, tx, request.RoleId, ct), ct);

        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(string roleId, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // Read the row before deleting it — afterwards its first string column is gone.
        var row = await LoadAsync(conn, tx, roleId, ct);
        if (row is null)
        {
            tx.Rollback();
            return false;
        }

        // Remove n-n rows first to satisfy the FK_AppUserRole_AppRole constraint.
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM AppUserRole WHERE RoleId = @RoleId",
            new { RoleId = roleId }, tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM AppRole WHERE RoleId = @RoleId",
            new { RoleId = roleId }, tx, cancellationToken: ct));

        await _audit.LogDeleteAsync(conn, tx, TableName, row, ct);

        tx.Commit();
        return true;
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
