using CMS.API.Controllers;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="RowAuditController"/> — the read side of the audit trail. The
/// repository is mocked so no database is required; the newest-first ordering is SQL, so it is
/// proved against the real database in <see cref="RowAuditRepositoryTests"/>.
/// </summary>
public class RowAuditControllerTests
{
    private readonly Mock<IRowAuditRepository> _repo = new(MockBehavior.Strict);
    private RowAuditController CreateController() => new(_repo.Object);

    private static RowAuditHistoryItem SampleItem(string actionType = "Update", string userName = "alice")
        => new()
        {
            DateTime = new DateTime(2026, 6, 4, 14, 30, 0, DateTimeKind.Utc),
            UserName = userName,
            ActionType = actionType,
            ActionDesc = "Title, DisplayOrder",
        };

    [Fact]
    public async Task GetForRecord_PassesTableNameAndPkidToTheRepository()
    {
        _repo.Setup(r => r.GetForRecordAsync("Course", "123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { SampleItem() });

        var result = await CreateController().GetForRecord("Course", "123", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Single((IEnumerable<RowAuditHistoryItem>)ok.Value!);
        _repo.Verify(r => r.GetForRecordAsync("Course", "123", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetForRecord_ReturnsEveryFieldOfTheTrail()
    {
        _repo.Setup(r => r.GetForRecordAsync("Course", "123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { SampleItem() });

        var result = await CreateController().GetForRecord("Course", "123", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var item = Assert.Single((IEnumerable<RowAuditHistoryItem>)ok.Value!);
        Assert.Equal(new DateTime(2026, 6, 4, 14, 30, 0, DateTimeKind.Utc), item.DateTime);
        Assert.Equal("alice", item.UserName);
        Assert.Equal("Update", item.ActionType);
        Assert.Equal("Title, DisplayOrder", item.ActionDesc);
    }

    [Fact]
    public async Task GetForRecord_PreservesTheRepositoryOrder()
    {
        // The controller must not re-sort: newest-first is the repository's ORDER BY.
        var newest = SampleItem("Update", "carol");
        var oldest = SampleItem("Insert", "alice");
        _repo.Setup(r => r.GetForRecordAsync("Course", "123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { newest, oldest });

        var result = await CreateController().GetForRecord("Course", "123", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var items = ((IEnumerable<RowAuditHistoryItem>)ok.Value!).ToList();
        Assert.Equal(new[] { "carol", "alice" }, items.Select(i => i.UserName));
    }

    [Fact]
    public async Task GetForRecord_WithNoHistory_ReturnsOkWithEmptyList()
    {
        // A record that has never changed is not a 404 — the badge renders an empty state.
        _repo.Setup(r => r.GetForRecordAsync("Course", "999", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<RowAuditHistoryItem>());

        var result = await CreateController().GetForRecord("Course", "999", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Empty((IEnumerable<RowAuditHistoryItem>)ok.Value!);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task GetForRecord_WithoutTableName_ReturnsBadRequestAndQueriesNothing(string? tableName)
    {
        var result = await CreateController().GetForRecord(tableName, "123", CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        _repo.Verify(r => r.GetForRecordAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task GetForRecord_WithoutPkid_ReturnsBadRequestAndQueriesNothing(string? pkid)
    {
        var result = await CreateController().GetForRecord("Course", pkid, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        _repo.Verify(r => r.GetForRecordAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
