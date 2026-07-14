using CMS.API.Controllers;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="PublishStatusesController"/> covering the PublishStatus endpoints:
/// list, filtered query, view, add, edit and delete. The repository is mocked so no database is required.
/// </summary>
public class PublishStatusesControllerTests
{
    private readonly Mock<IPublishStatusRepository> _repo = new(MockBehavior.Strict);
    private PublishStatusesController CreateController() => new(_repo.Object);

    private static PublishStatus SampleStatus(byte pkid = 1) => new()
    {
        Pkid = pkid,
        Description = "草稿",
        IsDraft = true,
        IsPublished = false,
        IsDiscontinued = false
    };

    // ---- List ----

    [Fact]
    public async Task GetAll_ReturnsOkWithAllStatuses()
    {
        var statuses = new[] { SampleStatus(1), SampleStatus(2) };
        _repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(statuses);

        var result = await CreateController().GetAll(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<PublishStatus>>(ok.Value);
        Assert.Equal(2, payload.Count());
    }

    // ---- Filtered query ----

    [Fact]
    public async Task Query_PassesQueryToRepository_AndReturnsMatches()
    {
        var query = new PublishStatusQuery { Keyword = "草稿", IsDraft = true };
        var matches = new[] { SampleStatus(1) };
        _repo.Setup(r => r.QueryAsync(query, It.IsAny<CancellationToken>())).ReturnsAsync(matches);

        var result = await CreateController().Query(query, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<PublishStatus>>(ok.Value);
        Assert.Single(payload);
        _repo.Verify(r => r.QueryAsync(query, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_WhenFound_ReturnsOkWithStatus()
    {
        _repo.Setup(r => r.GetByIdAsync((byte)1, It.IsAny<CancellationToken>())).ReturnsAsync(SampleStatus(1));

        var result = await CreateController().GetById(1, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var status = Assert.IsType<PublishStatus>(ok.Value);
        Assert.Equal((byte)1, status.Pkid);
    }

    [Fact]
    public async Task GetById_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.GetByIdAsync((byte)99, It.IsAny<CancellationToken>())).ReturnsAsync((PublishStatus?)null);

        var result = await CreateController().GetById(99, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_WhenValidAndNew_ReturnsCreatedAtAction()
    {
        var request = new PublishStatusRequest
        {
            Pkid = 5,
            Description = "已發布",
            IsPublished = true
        };
        _repo.Setup(r => r.ExistsAsync((byte)5, It.IsAny<CancellationToken>())).ReturnsAsync(false);
        _repo.Setup(r => r.CreateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync((byte)5);
        _repo.Setup(r => r.GetByIdAsync((byte)5, It.IsAny<CancellationToken>())).ReturnsAsync(SampleStatus(5));

        var result = await CreateController().Create(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(PublishStatusesController.GetById), created.ActionName);
        Assert.Equal((byte)5, created.RouteValues!["id"]);
        _repo.Verify(r => r.CreateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_WhenPkidExists_ReturnsConflict()
    {
        var request = new PublishStatusRequest { Pkid = 1, Description = "草稿" };
        _repo.Setup(r => r.ExistsAsync((byte)1, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result.Result);
        _repo.Verify(r => r.CreateAsync(It.IsAny<PublishStatusRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenDescriptionMissing_ReturnsBadRequest()
    {
        var request = new PublishStatusRequest { Pkid = 1, Description = "" };

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_WhenFound_ReturnsOkWithUpdatedStatus()
    {
        var request = new PublishStatusRequest
        {
            Pkid = 1,
            Description = "草稿（已編輯）",
            IsDraft = true
        };
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _repo.Setup(r => r.GetByIdAsync((byte)1, It.IsAny<CancellationToken>())).ReturnsAsync(SampleStatus(1));

        var result = await CreateController().Update(request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.IsType<PublishStatus>(ok.Value);
        _repo.Verify(r => r.UpdateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Update_WhenMissing_ReturnsNotFound()
    {
        var request = new PublishStatusRequest { Pkid = 99, Description = "幽靈" };
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().Update(request, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Update_WhenDescriptionMissing_ReturnsBadRequest()
    {
        var request = new PublishStatusRequest { Pkid = 1, Description = "" };

        var result = await CreateController().Update(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Delete ----

    [Fact]
    public async Task Delete_WhenFound_ReturnsNoContent()
    {
        _repo.Setup(r => r.DeleteAsync((byte)1, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await CreateController().Delete(1, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task Delete_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.DeleteAsync((byte)99, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().Delete(99, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }
}
