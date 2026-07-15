using System.Security.Claims;
using CMS.API.Auditing;
using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Tests.Infrastructure;
using Dapper;
using Microsoft.AspNetCore.Http;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Proves the audit-trail query's filtering and ordering, which live in SQL and so cannot be reached
/// with mocks — see <see cref="DatabaseFactAttribute"/> for the skip-when-absent behaviour.
/// <para>
/// Rows are inserted directly rather than through a repository: this is about the read query, and
/// seeding the exact timestamps is what makes the ordering assertions meaningful.
/// </para>
/// </summary>
public class RowAuditRepositoryTests : IDisposable
{
    /// <summary>Tags every row this class writes, so teardown can find them all.</summary>
    private const string Marker = "rowaudit-repo-test";

    private static readonly DateTime T1 = new(2026, 6, 1, 8, 0, 0);
    private static readonly DateTime T2 = new(2026, 6, 2, 9, 30, 0);
    private static readonly DateTime T3 = new(2026, 6, 4, 14, 30, 0);

    /// <summary>Partners created through a real repository, torn down with their audit rows.</summary>
    private readonly List<short> _createdPartnerPkids = [];

    private static RowAuditRepository CreateRepository() => new(new TestDatabase.ConnectionFactory());

    private static void Seed(string tableName, string pkid, string actionType, DateTime when, string? desc = null)
    {
        using var conn = TestDatabase.OpenConnection();
        conn.Execute(@"
INSERT INTO RowAudit (TableName, UserName, PrimaryKeyValues, ActionType, ActionDesc, [DateTime])
VALUES (@TableName, @UserName, @Pkid, @ActionType, @Desc, @When);",
            new { TableName = tableName, UserName = Marker, Pkid = pkid, ActionType = actionType, Desc = desc, When = when });
    }

    public void Dispose()
    {
        if (!TestDatabase.IsAvailable) return;

        using var conn = TestDatabase.OpenConnection();
        conn.Execute("DELETE FROM RowAudit WHERE UserName = @Marker", new { Marker });

        foreach (var pkid in _createdPartnerPkids)
        {
            conn.Execute("DELETE FROM RowAudit WHERE TableName = 'Partner' AND PrimaryKeyValues = @Pkid",
                new { Pkid = pkid.ToString() });
            conn.Execute("DELETE FROM Partner WHERE pkid = @Pkid", new { Pkid = pkid });
        }
    }

    [DatabaseFact]
    public async Task GetForRecordAsync_ReturnsOnlyRowsForThatTableAndPkid()
    {
        Seed("Course", "123", "Insert", T1);
        Seed("Course", "124", "Insert", T1);   // same table, different record
        Seed("Partner", "123", "Insert", T1);  // same pkid, different table

        var trail = (await CreateRepository().GetForRecordAsync("Course", "123")).ToList();

        var item = Assert.Single(trail);
        Assert.Equal("Insert", item.ActionType);
        Assert.Equal(Marker, item.UserName);
    }

    [DatabaseFact]
    public async Task GetForRecordAsync_ReturnsNewestFirst()
    {
        // Seeded out of order, so passing cannot be an accident of insertion order.
        Seed("Course", "123", "Update", T2, "Title");
        Seed("Course", "123", "Delete", T3, "Azure 101");
        Seed("Course", "123", "Insert", T1, "Azure 101");

        var trail = (await CreateRepository().GetForRecordAsync("Course", "123")).ToList();

        Assert.Equal(new[] { "Delete", "Update", "Insert" }, trail.Select(i => i.ActionType));
        Assert.Equal(new[] { T3, T2, T1 }, trail.Select(i => i.DateTime));
    }

    [DatabaseFact]
    public async Task GetForRecordAsync_BreaksTimestampTiesByInsertionOrderNewestFirst()
    {
        // datetime has ~3ms resolution, so a burst of changes can share a timestamp.
        Seed("Course", "123", "Insert", T1, "first");
        Seed("Course", "123", "Update", T1, "second");
        Seed("Course", "123", "Delete", T1, "third");

        var trail = (await CreateRepository().GetForRecordAsync("Course", "123")).ToList();

        Assert.Equal(new[] { "third", "second", "first" }, trail.Select(i => i.ActionDesc));
    }

    [DatabaseFact]
    public async Task GetForRecordAsync_ReturnsEveryFieldOfTheTrail()
    {
        Seed("Course", "123", "Update", T3, "Title, DisplayOrder");

        var item = Assert.Single(await CreateRepository().GetForRecordAsync("Course", "123"));

        Assert.Equal(T3, item.DateTime);
        Assert.Equal(Marker, item.UserName);
        Assert.Equal("Update", item.ActionType);
        Assert.Equal("Title, DisplayOrder", item.ActionDesc);
    }

    [DatabaseFact]
    public async Task GetForRecordAsync_WithNoHistory_ReturnsEmpty()
    {
        Assert.Empty(await CreateRepository().GetForRecordAsync("Course", "no-such-record"));
    }

    [DatabaseFact]
    public async Task GetForRecordAsync_ToleratesANullActionDesc()
    {
        // ActionDesc is nullable in the schema.
        Seed("Course", "123", "Insert", T1, desc: null);

        var item = Assert.Single(await CreateRepository().GetForRecordAsync("Course", "123"));

        Assert.Null(item.ActionDesc);
    }

    /// <summary>
    /// Closes the loop: a real repository change written by the RowAudit writer must be readable
    /// through the query the badge calls. The two halves agree on TableName and PrimaryKeyValues
    /// only if they are actually exercised together.
    /// </summary>
    [DatabaseFact]
    public async Task GetForRecordAsync_ReadsBackTheTrailOfARealRepositoryChange()
    {
        var accessor = new Mock<IHttpContextAccessor>();
        accessor.SetupGet(a => a.HttpContext).Returns(new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                new[] { new Claim(ClaimTypes.Name, "Helen Chen") }, "Bearer")),
        });

        var partners = new PartnerRepository(
            new TestDatabase.ConnectionFactory(), new RowAuditWriter(accessor.Object));

        var pkid = await partners.CreateAsync(new PartnerRequest
        {
            Name = "Trail Readback Ltd",
            AppKey = "TRL",
            NameOnPartnerMenu = "Trail",
            NameOnCourseDetailPage = "Trail Readback",
            DisplayOrder = 902,
        });
        _createdPartnerPkids.Add(pkid);

        var item = Assert.Single(await CreateRepository().GetForRecordAsync("Partner", pkid.ToString()));

        Assert.Equal("Insert", item.ActionType);
        Assert.Equal("Trail Readback Ltd", item.ActionDesc);
        Assert.Equal("Helen Chen", item.UserName);
    }
}
