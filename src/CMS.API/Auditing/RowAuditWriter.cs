using System.Collections;
using System.Data;
using System.Reflection;
using System.Security.Claims;
using Dapper;

namespace CMS.API.Auditing;

/// <summary>
/// Generic RowAudit writer: describes a change to any entity type by reflection, then inserts one
/// RowAudit row with Dapper on the caller's connection and transaction — so the audit row commits
/// or rolls back atomically with the change it describes.
/// </summary>
public class RowAuditWriter : IRowAuditWriter
{
    /// <summary>Written as UserName when the request carries no authenticated user.</summary>
    public const string SystemUserName = "system";

    /// <summary>ActionDesc is <c>varchar(1000)</c>; longer text is truncated rather than failing the insert.</summary>
    private const int ActionDescMaxLength = 1000;

    // [DateTime] is bracketed — it collides with the type name in T-SQL.
    private const string InsertSql = @"
INSERT INTO RowAudit (TableName, UserName, PrimaryKeyValues, ActionType, ActionDesc, [DateTime])
VALUES (@TableName, @UserName, @PrimaryKeyValues, @ActionType, @ActionDesc, @DateTime);";

    private readonly IHttpContextAccessor _httpContextAccessor;

    public RowAuditWriter(IHttpContextAccessor httpContextAccessor)
        => _httpContextAccessor = httpContextAccessor;

    public Task LogInsertAsync<T>(
        IDbConnection conn, IDbTransaction tx, string tableName, T entity, CancellationToken ct = default)
        where T : notnull
        => WriteAsync(conn, tx, BuildInsert(tableName, entity), ct);

    public Task LogDeleteAsync<T>(
        IDbConnection conn, IDbTransaction tx, string tableName, T entity, CancellationToken ct = default)
        where T : notnull
        => WriteAsync(conn, tx, BuildDelete(tableName, entity), ct);

    public Task LogUpdateAsync<T>(
        IDbConnection conn, IDbTransaction tx, string tableName, T before, T after, CancellationToken ct = default)
        where T : notnull
    {
        var entry = BuildUpdate(tableName, before, after);

        // An update that changed nothing carries no information — skip the row entirely.
        return entry.ActionDesc.Length == 0 ? Task.CompletedTask : WriteAsync(conn, tx, entry, ct);
    }

    // ---- Entry building (no database; unit tested directly) ----

    internal RowAuditEntry BuildInsert<T>(string tableName, T entity) where T : notnull
        => new(tableName, ResolveUserName(), PrimaryKeyValues(entity), "Insert",
            Truncate(FirstStringPropertyValue(entity)), DateTime.UtcNow);

    internal RowAuditEntry BuildDelete<T>(string tableName, T entity) where T : notnull
        => new(tableName, ResolveUserName(), PrimaryKeyValues(entity), "Delete",
            Truncate(FirstStringPropertyValue(entity)), DateTime.UtcNow);

    internal RowAuditEntry BuildUpdate<T>(string tableName, T before, T after) where T : notnull
    {
        if (before.GetType() != after.GetType())
        {
            throw new ArgumentException(
                $"before ({before.GetType().Name}) and after ({after.GetType().Name}) must be the same type.",
                nameof(after));
        }

        return new(tableName, ResolveUserName(), PrimaryKeyValues(after), "Update",
            Truncate(ChangedPropertyNames(before, after)), DateTime.UtcNow);
    }

    /// <summary>
    /// The UserName claim of the current request's JWT, or <see cref="SystemUserName"/> when the
    /// request is unauthenticated or there is no request at all.
    /// </summary>
    private string ResolveUserName()
    {
        var userName = _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Name);
        return string.IsNullOrWhiteSpace(userName) ? SystemUserName : userName;
    }

    // ---- Reflection ----

    /// <remarks>
    /// GetProperties() has no documented ordering; MetadataToken recovers declaration order, which
    /// is what picks the intended "first string property".
    /// </remarks>
    private static PropertyInfo[] ReadableProperties(Type type)
        => type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => p.CanRead && p.GetIndexParameters().Length == 0)
            .OrderBy(p => p.MetadataToken)
            .ToArray();

    private static string PrimaryKeyValues(object entity)
    {
        var pkid = ReadableProperties(entity.GetType())
            .FirstOrDefault(p => string.Equals(p.Name, "pkid", StringComparison.OrdinalIgnoreCase));
        return pkid?.GetValue(entity)?.ToString() ?? string.Empty;
    }

    private static string FirstStringPropertyValue(object entity)
    {
        var first = ReadableProperties(entity.GetType())
            .FirstOrDefault(p => p.PropertyType == typeof(string));
        return first?.GetValue(entity) as string ?? string.Empty;
    }

    private static string ChangedPropertyNames(object before, object after)
        => string.Join(", ", ReadableProperties(before.GetType())
            .Where(p => !ValuesEqual(p.GetValue(before), p.GetValue(after)))
            .Select(p => p.Name));

    private static bool ValuesEqual(object? before, object? after)
    {
        if (before is null || after is null) return before is null && after is null;
        if (before is string) return before.Equals(after);

        // Collection properties (the n-n id lists) compare by contents: List<T>.Equals is reference
        // equality, which would report every list-valued property as changed on every update.
        if (before is IEnumerable b && after is IEnumerable a)
        {
            return b.Cast<object?>().SequenceEqual(a.Cast<object?>());
        }

        return before.Equals(after);
    }

    private static string Truncate(string value)
        => value.Length <= ActionDescMaxLength ? value : value[..ActionDescMaxLength];

    // ---- Persistence ----

    private static async Task WriteAsync(
        IDbConnection conn, IDbTransaction tx, RowAuditEntry entry, CancellationToken ct)
    {
        await conn.ExecuteAsync(new CommandDefinition(InsertSql, new
        {
            entry.TableName,
            entry.UserName,
            entry.PrimaryKeyValues,
            entry.ActionType,
            entry.ActionDesc,
            DateTime = entry.Timestamp,
        }, tx, cancellationToken: ct));
    }
}
