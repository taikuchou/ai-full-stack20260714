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
/// Proves the RowAudit retrofit end-to-end on one representative repository. These tests need a real
/// database: Dapper requires a real DbConnection, so a repository's behaviour cannot be reached with
/// mocks. They skip (not fail) when the CMS database is absent — see <see cref="DatabaseFactAttribute"/>.
/// <para>
/// Every row this class creates is removed in <see cref="Dispose"/>, including the audit rows it causes.
/// </para>
/// </summary>
public class PartnerRepositoryAuditTests : IDisposable
{
    private const string TestUserName = "Helen Chen";

    /// <summary>Partners created by a test, torn down afterwards along with their audit rows.</summary>
    private readonly List<short> _createdPkids = [];

    private static PartnerRepository CreateRepository(bool authenticated = true)
    {
        var accessor = new Mock<IHttpContextAccessor>();
        var identity = authenticated
            ? new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, TestUserName) }, "Bearer")
            : new ClaimsIdentity();
        accessor.SetupGet(a => a.HttpContext)
            .Returns(new DefaultHttpContext { User = new ClaimsPrincipal(identity) });

        return new PartnerRepository(new TestDatabase.ConnectionFactory(), new RowAuditWriter(accessor.Object));
    }

    private static PartnerRequest SampleRequest(string name = "Contoso Training") => new()
    {
        Name = name,
        AppKey = "CTSO",
        NameOnPartnerMenu = "Contoso",
        NameOnCourseDetailPage = "Contoso Ltd",
        DisplayOrder = 900,
        ImageFilename = null,
    };

    private sealed record AuditRow(string TableName, string UserName, string PrimaryKeyValues, string ActionType, string ActionDesc);

    private static List<AuditRow> AuditRowsFor(short pkid)
    {
        using var conn = TestDatabase.OpenConnection();
        return conn.Query<AuditRow>(@"
SELECT TableName, UserName, PrimaryKeyValues, ActionType, ActionDesc
FROM RowAudit
WHERE TableName = 'Partner' AND PrimaryKeyValues = @Pkid
ORDER BY pkid ASC",
            new { Pkid = pkid.ToString() }).ToList();
    }

    private async Task<short> CreatePartnerAsync(string name = "Contoso Training")
    {
        var pkid = await CreateRepository().CreateAsync(SampleRequest(name));
        _createdPkids.Add(pkid);
        return pkid;
    }

    public void Dispose()
    {
        if (!TestDatabase.IsAvailable) return;

        using var conn = TestDatabase.OpenConnection();
        foreach (var pkid in _createdPkids)
        {
            conn.Execute("DELETE FROM RowAudit WHERE TableName = 'Partner' AND PrimaryKeyValues = @Pkid",
                new { Pkid = pkid.ToString() });
            conn.Execute("DELETE FROM Partner WHERE pkid = @Pkid", new { Pkid = pkid });
        }
    }

    [DatabaseFact]
    public async Task CreateAsync_WritesAnInsertAuditRowCarryingTheFirstStringColumn()
    {
        var pkid = await CreatePartnerAsync("Contoso Training");

        var audit = Assert.Single(AuditRowsFor(pkid));
        Assert.Equal("Partner", audit.TableName);
        Assert.Equal("Insert", audit.ActionType);
        Assert.Equal("Contoso Training", audit.ActionDesc); // Partner.Name is the first string property
        Assert.Equal(pkid.ToString(), audit.PrimaryKeyValues);
        Assert.Equal(TestUserName, audit.UserName);
    }

    [DatabaseFact]
    public async Task UpdateAsync_WritesAnUpdateAuditRowListingExactlyTheChangedColumns()
    {
        var pkid = await CreatePartnerAsync();

        var request = SampleRequest();
        request.Pkid = pkid;
        request.Name = "Contoso Global";  // changed
        request.DisplayOrder = 901;       // changed; every other column keeps its value

        Assert.True(await CreateRepository().UpdateAsync(request));

        var audit = AuditRowsFor(pkid).Single(r => r.ActionType == "Update");
        Assert.Equal("Name, DisplayOrder", audit.ActionDesc);
        Assert.Equal(pkid.ToString(), audit.PrimaryKeyValues);
    }

    [DatabaseFact]
    public async Task UpdateAsync_WithNoActualChange_WritesNoUpdateAuditRow()
    {
        var pkid = await CreatePartnerAsync();

        var request = SampleRequest();
        request.Pkid = pkid; // identical values

        Assert.True(await CreateRepository().UpdateAsync(request));

        Assert.DoesNotContain(AuditRowsFor(pkid), r => r.ActionType == "Update");
    }

    [DatabaseFact]
    public async Task DeleteAsync_WritesADeleteAuditRowCarryingTheFirstStringColumn()
    {
        var pkid = await CreatePartnerAsync("Fabrikam Institute");

        Assert.True(await CreateRepository().DeleteAsync(pkid));

        var audit = AuditRowsFor(pkid).Single(r => r.ActionType == "Delete");
        Assert.Equal("Fabrikam Institute", audit.ActionDesc);
        Assert.Equal(pkid.ToString(), audit.PrimaryKeyValues);
        Assert.Equal(TestUserName, audit.UserName);
    }

    [DatabaseFact]
    public async Task UpdateAsync_OnAMissingRow_WritesNoAuditRow()
    {
        const short missingPkid = short.MaxValue;
        var request = SampleRequest();
        request.Pkid = missingPkid;

        Assert.False(await CreateRepository().UpdateAsync(request));

        Assert.Empty(AuditRowsFor(missingPkid));
    }

    [DatabaseFact]
    public async Task DeleteAsync_OnAMissingRow_WritesNoAuditRow()
    {
        const short missingPkid = short.MaxValue;

        Assert.False(await CreateRepository().DeleteAsync(missingPkid));

        Assert.Empty(AuditRowsFor(missingPkid));
    }

    [DatabaseFact]
    public async Task CreateAsync_WithNoAuthenticatedUser_AuditsAsSystem()
    {
        var pkid = await CreateRepository(authenticated: false).CreateAsync(SampleRequest());
        _createdPkids.Add(pkid);

        Assert.Equal("system", Assert.Single(AuditRowsFor(pkid)).UserName);
    }
}
