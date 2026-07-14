using System.Data;

namespace CMS.API.Data;

/// <summary>
/// Creates open ADO.NET connections for Dapper. Registered as a singleton;
/// each call returns a fresh connection the caller is responsible for disposing.
/// </summary>
public interface IDbConnectionFactory
{
    Task<IDbConnection> CreateOpenConnectionAsync(CancellationToken ct = default);
}
