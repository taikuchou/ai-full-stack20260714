using System.Data;
using CMS.API.Data;
using Microsoft.Data.SqlClient;

namespace CMS.API.Tests.Infrastructure;

/// <summary>
/// The local CMS database, used by the few tests that cannot run without one (Dapper needs a real
/// DbConnection, so repository behaviour is not reachable with mocks).
/// </summary>
public static class TestDatabase
{
    // Mirrors appsettings.json's "CMS" connection string, with a short timeout so probing a machine
    // that has no SQL Server fails fast rather than stalling the suite.
    public const string ConnectionString =
        "Server=.\\SQLEXPRESS;Database=CMS;Trusted_Connection=True;TrustServerCertificate=True;Encrypt=False;Connect Timeout=3";

    private static readonly Lazy<bool> Probe = new(() =>
    {
        try
        {
            using var conn = new SqlConnection(ConnectionString);
            conn.Open();
            return true;
        }
        catch (SqlException)
        {
            return false;
        }
    });

    /// <summary>True when the CMS database is reachable. Probed once per test run.</summary>
    public static bool IsAvailable => Probe.Value;

    public static IDbConnection OpenConnection()
    {
        var conn = new SqlConnection(ConnectionString);
        conn.Open();
        return conn;
    }

    /// <summary>An <see cref="IDbConnectionFactory"/> over the real database, for repositories under test.</summary>
    public sealed class ConnectionFactory : IDbConnectionFactory
    {
        public async Task<IDbConnection> CreateOpenConnectionAsync(CancellationToken ct = default)
        {
            var conn = new SqlConnection(ConnectionString);
            await conn.OpenAsync(ct);
            return conn;
        }
    }
}

/// <summary>
/// A <see cref="FactAttribute"/> that skips instead of failing when the CMS database is absent, so
/// `dotnet test` stays green on a machine without SQL Server — see docs/setup-notes.md.
/// </summary>
public sealed class DatabaseFactAttribute : FactAttribute
{
    public DatabaseFactAttribute()
    {
        if (!TestDatabase.IsAvailable)
        {
            Skip = "Requires the CMS database on .\\SQLEXPRESS (see docs/setup-notes.md).";
        }
    }
}
