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
}
