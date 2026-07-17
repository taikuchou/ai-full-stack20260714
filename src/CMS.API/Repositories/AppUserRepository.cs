using System.Data;
using System.Text.Json;
using CMS.API.Auditing;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Security;
using Dapper;

namespace CMS.API.Repositories;

public class AppUserRepository : IAppUserRepository
{
    private const string TableName = "AppUser";

    private readonly IDbConnectionFactory _factory;
    private readonly IRowAuditWriter _audit;

    public AppUserRepository(IDbConnectionFactory factory, IRowAuditWriter audit)
    {
        _factory = factory;
        _audit = audit;
    }

    // Shared SELECT for list/view. RoleCount is a correlated subquery over the AppUserRole n-n table.
    // PasswordHash is intentionally never selected — it must not reach the client.
    private const string SelectList = @"
SELECT u.pkid                AS Pkid,
       u.UserId              AS UserId,
       u.UserName            AS UserName,
       u.IsActive            AS IsActive,
       u.PasswordUpdatedTime AS PasswordUpdatedTime,
       (SELECT COUNT(*) FROM AppUserRole ur WHERE ur.UserId = u.UserId) AS RoleCount
FROM AppUser u";

    public async Task<IEnumerable<AppUser>> GetAllAsync(CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<AppUser>(
            new CommandDefinition($"{SelectList} ORDER BY u.UserId ASC", cancellationToken: ct));
    }

    public async Task<IEnumerable<AppUser>> QueryAsync(AppUserQuery query, CancellationToken ct = default)
    {
        var sql = $@"{SelectList}
WHERE (@Keyword IS NULL
        OR u.UserId LIKE @KeywordLike
        OR u.UserName LIKE @KeywordLike)
  AND (@IsActive IS NULL OR u.IsActive = @IsActive)
ORDER BY u.UserId ASC";

        var keyword = string.IsNullOrWhiteSpace(query.Keyword) ? null : query.Keyword.Trim();
        var parameters = new
        {
            Keyword = keyword,
            KeywordLike = keyword is null ? null : $"%{keyword}%",
            query.IsActive
        };

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<AppUser>(new CommandDefinition(sql, parameters, cancellationToken: ct));
    }

    public async Task<AppUser?> GetByIdAsync(string userId, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await LoadAsync(conn, null, userId, ct);
    }

    /// <summary>
    /// Reads a user and their role links. Takes the caller's transaction so audit "before" snapshots
    /// see the same uncommitted state as the change itself.
    /// </summary>
    private static async Task<AppUser?> LoadAsync(
        IDbConnection conn, IDbTransaction? tx, string userId, CancellationToken ct)
    {
        var sql = $@"{SelectList} WHERE u.UserId = @UserId;
SELECT ur.RoleId FROM AppUserRole ur WHERE ur.UserId = @UserId ORDER BY ur.RoleId;";

        using var multi = await conn.QueryMultipleAsync(
            new CommandDefinition(sql, new { UserId = userId }, tx, cancellationToken: ct));

        var user = await multi.ReadFirstOrDefaultAsync<AppUser>();
        if (user is null) return null;

        user.RoleIds = (await multi.ReadAsync<string>()).ToList();
        return user;
    }

    /// <summary>Loads a row that must exist because the caller just wrote it inside this transaction.</summary>
    private static async Task<AppUser> RequireAsync(
        IDbConnection conn, IDbTransaction tx, string userId, CancellationToken ct)
        => await LoadAsync(conn, tx, userId, ct)
           ?? throw new InvalidOperationException($"{TableName} {userId} is missing immediately after being written.");

    public async Task<bool> ExistsAsync(string userId, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        var count = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(1) FROM AppUser WHERE UserId = @UserId",
            new { UserId = userId }, cancellationToken: ct));
        return count > 0;
    }

    public async Task<string> CreateAsync(AppUserRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);

        // New accounts start with the configured default password (SHA-256 hashed).
        var passwordHash = PasswordHasher.Hash(await GetDefaultPasswordAsync(conn, null, ct));

        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync(new CommandDefinition(@"
INSERT INTO AppUser (UserId, UserName, IsActive, PasswordHash, PasswordUpdatedTime)
VALUES (@UserId, @UserName, @IsActive, @PasswordHash, GETUTCDATE());",
            new { request.UserId, request.UserName, request.IsActive, PasswordHash = passwordHash },
            tx, cancellationToken: ct));

        await SyncRolesAsync(conn, tx, request.UserId, request.RoleIds, ct);

        await _audit.LogInsertAsync(conn, tx, TableName, await RequireAsync(conn, tx, request.UserId, ct), ct);

        tx.Commit();
        return request.UserId;
    }

    public async Task<bool> UpdateAsync(AppUserRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // Read the "before" inside the transaction so the audited change list is accurate.
        var before = await LoadAsync(conn, tx, request.UserId, ct);
        if (before is null)
        {
            tx.Rollback();
            return false;
        }

        // Password hash is deliberately excluded here — see ResetPasswordAsync.
        var affected = await conn.ExecuteAsync(new CommandDefinition(@"
UPDATE AppUser
SET UserName = @UserName,
    IsActive = @IsActive
WHERE UserId = @UserId;",
            new { request.UserId, request.UserName, request.IsActive },
            tx, cancellationToken: ct));

        if (affected == 0)
        {
            tx.Rollback();
            return false;
        }

        await SyncRolesAsync(conn, tx, request.UserId, request.RoleIds, ct);

        await _audit.LogUpdateAsync(
            conn, tx, TableName, before, await RequireAsync(conn, tx, request.UserId, ct), ct);

        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(string userId, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // Read the row before deleting it — afterwards its first string column is gone.
        var row = await LoadAsync(conn, tx, userId, ct);
        if (row is null)
        {
            tx.Rollback();
            return false;
        }

        // Remove n-n rows first to satisfy the FK_AppUserRole_AppUser constraint.
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM AppUserRole WHERE UserId = @UserId",
            new { UserId = userId }, tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM AppUser WHERE UserId = @UserId",
            new { UserId = userId }, tx, cancellationToken: ct));

        await _audit.LogDeleteAsync(conn, tx, TableName, row, ct);

        tx.Commit();
        return true;
    }

    public async Task<bool> ResetPasswordAsync(string userId, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        var before = await LoadAsync(conn, tx, userId, ct);
        if (before is null)
        {
            tx.Rollback();
            return false;
        }

        var passwordHash = PasswordHasher.Hash(await GetDefaultPasswordAsync(conn, tx, ct));

        var affected = await conn.ExecuteAsync(new CommandDefinition(@"
UPDATE AppUser
SET PasswordHash = @PasswordHash,
    PasswordUpdatedTime = GETUTCDATE()
WHERE UserId = @UserId;",
            new { UserId = userId, PasswordHash = passwordHash }, tx, cancellationToken: ct));

        if (affected == 0)
        {
            tx.Rollback();
            return false;
        }

        // An admin resetting someone's password is audit-worthy. PasswordHash is never selected
        // into the model, so this records the PasswordUpdatedTime change, never the secret.
        await _audit.LogUpdateAsync(
            conn, tx, TableName, before, await RequireAsync(conn, tx, userId, ct), ct);

        tx.Commit();
        return true;
    }

    // Delete-then-reinsert the AppUserRole assignments for a user.
    private static async Task SyncRolesAsync(
        IDbConnection conn, IDbTransaction tx, string userId, List<string> roleIds, CancellationToken ct)
    {
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM AppUserRole WHERE UserId = @UserId",
            new { UserId = userId }, tx, cancellationToken: ct));

        var distinct = roleIds
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Select(r => r.Trim())
            .Distinct()
            .ToList();

        if (distinct.Count == 0) return;

        await conn.ExecuteAsync(new CommandDefinition(
            "INSERT INTO AppUserRole (UserId, RoleId) VALUES (@UserId, @RoleId)",
            distinct.Select(r => new { UserId = userId, RoleId = r }),
            tx, cancellationToken: ct));
    }

    // Reads SysConfig['appConfig'].defaultPassword. The configValue is a JSON object.
    private static async Task<string> GetDefaultPasswordAsync(
        IDbConnection conn, IDbTransaction? tx, CancellationToken ct)
    {
        var configValue = await conn.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT configValue FROM SysConfig WHERE configKey = 'appConfig'",
            transaction: tx, cancellationToken: ct));

        if (string.IsNullOrWhiteSpace(configValue))
            throw new InvalidOperationException("SysConfig 'appConfig' entry is missing.");

        using var doc = JsonDocument.Parse(configValue);
        if (!doc.RootElement.TryGetProperty("defaultPassword", out var prop)
            || prop.ValueKind != JsonValueKind.String
            || string.IsNullOrEmpty(prop.GetString()))
        {
            throw new InvalidOperationException("SysConfig 'appConfig' has no 'defaultPassword' value.");
        }

        return prop.GetString()!;
    }
}
