using System.Text.Json;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class AuthRepository : IAuthRepository
{
    private readonly IDbConnectionFactory _factory;

    public AuthRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<AppUserCredential?> GetCredentialAsync(string userId, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<AppUserCredential>(new CommandDefinition(@"
SELECT UserId, UserName, IsActive, PasswordHash
FROM AppUser
WHERE UserId = @UserId",
            new { UserId = userId }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<string>> GetRoleIdsAsync(string userId, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        var roleIds = await conn.QueryAsync<string>(new CommandDefinition(
            "SELECT RoleId FROM AppUserRole WHERE UserId = @UserId ORDER BY RoleId",
            new { UserId = userId }, cancellationToken: ct));
        return roleIds.ToList();
    }

    // Reads SysConfig['appConfig'].symmetricSecurityKey. The configValue is a JSON object.
    public async Task<string> GetSigningKeyAsync(CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        var configValue = await conn.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT configValue FROM SysConfig WHERE configKey = 'appConfig'", cancellationToken: ct));

        if (string.IsNullOrWhiteSpace(configValue))
            throw new InvalidOperationException("SysConfig 'appConfig' entry is missing.");

        using var doc = JsonDocument.Parse(configValue);
        if (!doc.RootElement.TryGetProperty("symmetricSecurityKey", out var prop)
            || prop.ValueKind != JsonValueKind.String
            || string.IsNullOrEmpty(prop.GetString()))
        {
            throw new InvalidOperationException("SysConfig 'appConfig' has no 'symmetricSecurityKey' value.");
        }

        return prop.GetString()!;
    }
}
