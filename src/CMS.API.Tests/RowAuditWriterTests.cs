using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using CMS.API.Auditing;
using CMS.API.Security;
using Microsoft.AspNetCore.Http;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="RowAuditWriter"/>'s reflection logic. Every test drives the
/// entry-building step, which touches no database.
/// </summary>
public class RowAuditWriterTests
{
    private const string SigningKey = "unit-test-symmetric-security-key-1234567890";

    /// <summary>An entity shaped like the real models: IDENTITY pkid first, then a title.</summary>
    private class SampleCourse
    {
        public int Pkid { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Note { get; set; }
        public int DisplayOrder { get; set; }
        public List<int> Tags { get; set; } = [];
    }

    private static SampleCourse Sample() => new()
    {
        Pkid = 42,
        Title = "Azure Fundamentals",
        Note = "internal",
        DisplayOrder = 3,
        Tags = [1, 2],
    };

    private RowAuditWriter CreateWriter(ClaimsPrincipal? user = null)
    {
        var accessor = new Mock<IHttpContextAccessor>();
        accessor.SetupGet(a => a.HttpContext)
            .Returns(user is null ? null : new DefaultHttpContext { User = user });
        return new RowAuditWriter(accessor.Object);
    }

    /// <summary>
    /// A principal built from a token issued by the real <see cref="JwtTokenGenerator"/>, carrying
    /// the claim types the JWT middleware would actually surface. Deriving the fixture from a real
    /// token (rather than hand-writing the claim) is what pins the writer to the issuer's contract.
    /// </summary>
    private static ClaimsPrincipal PrincipalFromRealToken(string userId, string userName)
    {
        var token = JwtTokenGenerator.Generate(
            userId, userName, new[] { "Admin" }, SigningKey, TimeSpan.FromHours(1));
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        return new ClaimsPrincipal(new ClaimsIdentity(jwt.Claims, "Bearer"));
    }

    private static ClaimsPrincipal AnonymousPrincipal() => new(new ClaimsIdentity());

    // ---- ActionDesc: first string property (Insert / Delete) ----

    [Fact]
    public void BuildInsert_UsesFirstStringPropertyAsActionDesc()
    {
        var entry = CreateWriter().BuildInsert("Course", Sample());

        Assert.Equal("Course", entry.TableName);
        Assert.Equal("Insert", entry.ActionType);
        Assert.Equal("Azure Fundamentals", entry.ActionDesc);
    }

    [Fact]
    public void BuildDelete_UsesFirstStringPropertyAsActionDesc()
    {
        var entry = CreateWriter().BuildDelete("Course", Sample());

        Assert.Equal("Delete", entry.ActionType);
        Assert.Equal("Azure Fundamentals", entry.ActionDesc);
    }

    [Fact]
    public void BuildInsert_WithNoStringProperty_WritesEmptyActionDesc()
    {
        var entry = CreateWriter().BuildInsert("Counter", new { Pkid = 7, Total = 3 });

        Assert.Equal(string.Empty, entry.ActionDesc);
    }

    [Fact]
    public void BuildInsert_WithNullFirstStringProperty_WritesEmptyActionDesc()
    {
        var entity = new SampleCourse { Pkid = 1, Title = null! };

        var entry = CreateWriter().BuildInsert("Course", entity);

        Assert.Equal(string.Empty, entry.ActionDesc);
    }

    // ---- ActionDesc: changed property names (Update) ----

    [Fact]
    public void BuildUpdate_ListsOnlyChangedPropertyNamesInDeclarationOrder()
    {
        var before = Sample();
        var after = Sample();
        after.Title = "Azure Advanced";
        after.DisplayOrder = 9;

        var entry = CreateWriter().BuildUpdate("Course", before, after);

        Assert.Equal("Update", entry.ActionType);
        Assert.Equal("Title, DisplayOrder", entry.ActionDesc);
    }

    [Fact]
    public void BuildUpdate_WithNoChanges_WritesEmptyActionDesc()
    {
        var entry = CreateWriter().BuildUpdate("Course", Sample(), Sample());

        Assert.Equal(string.Empty, entry.ActionDesc);
    }

    [Fact]
    public void BuildUpdate_DetectsNullTransitionsInBothDirections()
    {
        var before = Sample();
        before.Note = null;
        var after = Sample();
        after.Note = "now set";

        Assert.Equal("Note", CreateWriter().BuildUpdate("Course", before, after).ActionDesc);
        Assert.Equal("Note", CreateWriter().BuildUpdate("Course", after, before).ActionDesc);
    }

    [Fact]
    public void BuildUpdate_ComparesCollectionPropertiesByContentsNotReference()
    {
        var before = Sample();
        var after = Sample();
        after.Tags = [1, 2]; // equal contents, different instance — must not count as a change

        Assert.Equal(string.Empty, CreateWriter().BuildUpdate("Course", before, after).ActionDesc);

        after.Tags = [1, 2, 3];
        Assert.Equal("Tags", CreateWriter().BuildUpdate("Course", before, after).ActionDesc);
    }

    // ---- PrimaryKeyValues ----

    [Fact]
    public void Build_ReadsPrimaryKeyValuesFromPkid()
    {
        var writer = CreateWriter();

        Assert.Equal("42", writer.BuildInsert("Course", Sample()).PrimaryKeyValues);
        Assert.Equal("42", writer.BuildDelete("Course", Sample()).PrimaryKeyValues);
        Assert.Equal("42", writer.BuildUpdate("Course", Sample(), Sample()).PrimaryKeyValues);
    }

    [Fact]
    public void Build_ReadsPrimaryKeyValuesFromStringPkid()
    {
        // The nvarchar-PK tables (AppRole, AppUser) name the key column differently.
        var entry = CreateWriter().BuildInsert("AppRole", new { pkid = "Admin", RoleName = "系統管理" });

        Assert.Equal("Admin", entry.PrimaryKeyValues);
    }

    [Fact]
    public void Build_WithNoPkidProperty_WritesEmptyPrimaryKeyValues()
    {
        var entry = CreateWriter().BuildInsert("Odd", new { Title = "no key here" });

        Assert.Equal(string.Empty, entry.PrimaryKeyValues);
    }

    // ---- UserName ----

    [Fact]
    public void Build_ReadsUserNameFromTheCurrentRequestsToken()
    {
        var writer = CreateWriter(PrincipalFromRealToken("helen", "Helen Chen"));

        Assert.Equal("Helen Chen", writer.BuildInsert("Course", Sample()).UserName);
    }

    [Fact]
    public void Build_WithNoHttpContext_FallsBackToSystemUserName()
    {
        var entry = CreateWriter().BuildInsert("Course", Sample());

        Assert.Equal("system", entry.UserName);
    }

    [Fact]
    public void Build_WithUnauthenticatedRequest_FallsBackToSystemUserName()
    {
        var entry = CreateWriter(AnonymousPrincipal()).BuildInsert("Course", Sample());

        Assert.Equal("system", entry.UserName);
    }

    // ---- Truncation ----

    [Fact]
    public void BuildInsert_TruncatesActionDescAt1000Characters()
    {
        var entity = new SampleCourse { Pkid = 1, Title = new string('x', 1500) };

        var entry = CreateWriter().BuildInsert("Course", entity);

        Assert.Equal(1000, entry.ActionDesc.Length);
        Assert.Equal(new string('x', 1000), entry.ActionDesc);
    }

    [Fact]
    public void BuildInsert_LeavesActionDescOfExactly1000CharactersIntact()
    {
        var entity = new SampleCourse { Pkid = 1, Title = new string('x', 1000) };

        Assert.Equal(1000, CreateWriter().BuildInsert("Course", entity).ActionDesc.Length);
    }

    // ---- Writing ----

    [Fact]
    public async Task LogUpdateAsync_WithNoChanges_WritesNoRow()
    {
        var conn = new Mock<IDbConnection>(MockBehavior.Strict);
        var tx = new Mock<IDbTransaction>(MockBehavior.Strict);

        await CreateWriter().LogUpdateAsync(conn.Object, tx.Object, "Course", Sample(), Sample());

        conn.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task LogUpdateAsync_WithChanges_ReachesTheConnection()
    {
        // Guards the test above from passing vacuously: a real change must reach the connection,
        // where Dapper rejects the mock because async requires a DbConnection.
        var conn = new Mock<IDbConnection>(MockBehavior.Strict);
        var tx = new Mock<IDbTransaction>(MockBehavior.Strict);
        var after = Sample();
        after.Title = "Azure Advanced";

        await Assert.ThrowsAnyAsync<Exception>(() =>
            CreateWriter().LogUpdateAsync(conn.Object, tx.Object, "Course", Sample(), after));
    }

    [Fact]
    public void BuildUpdate_WithMismatchedTypes_Throws()
    {
        var writer = CreateWriter();

        Assert.Throws<ArgumentException>(() =>
            writer.BuildUpdate<object>("Course", Sample(), new { Pkid = 42 }));
    }
}
