using CMS.API.Controllers;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="CourseGroupsController"/> covering the CourseGroup endpoints:
/// list, filtered query, view, add, edit and delete. The repository is mocked so no database is required.
/// </summary>
public class CourseGroupsControllerTests
{
    private readonly Mock<ICourseGroupRepository> _repo = new(MockBehavior.Strict);
    private CourseGroupsController CreateController() => new(_repo.Object);

    private static CourseGroup SampleCourseGroup(short pkid = 1) => new()
    {
        Pkid = pkid,
        Description = "資訊安全"
    };

    private static CourseGroupRequest ValidRequest(short pkid = 0) => new()
    {
        Pkid = pkid,
        Description = "資訊安全"
    };

    // ---- List ----

    [Fact]
    public async Task GetAll_ReturnsOkWithAllCourseGroups()
    {
        var groups = new[] { SampleCourseGroup(1), SampleCourseGroup(2) };
        _repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(groups);

        var result = await CreateController().GetAll(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<CourseGroup>>(ok.Value);
        Assert.Equal(2, payload.Count());
    }

    // ---- Filtered query ----

    [Fact]
    public async Task Query_PassesQueryToRepository_AndReturnsMatches()
    {
        var query = new CourseGroupQuery { Keyword = "資訊" };
        var matches = new[] { SampleCourseGroup(1) };
        _repo.Setup(r => r.QueryAsync(query, It.IsAny<CancellationToken>())).ReturnsAsync(matches);

        var result = await CreateController().Query(query, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<CourseGroup>>(ok.Value);
        Assert.Single(payload);
        _repo.Verify(r => r.QueryAsync(query, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_WhenFound_ReturnsOkWithCourseGroup()
    {
        _repo.Setup(r => r.GetByIdAsync((short)1, It.IsAny<CancellationToken>())).ReturnsAsync(SampleCourseGroup(1));

        var result = await CreateController().GetById(1, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var group = Assert.IsType<CourseGroup>(ok.Value);
        Assert.Equal((short)1, group.Pkid);
    }

    [Fact]
    public async Task GetById_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.GetByIdAsync((short)99, It.IsAny<CancellationToken>())).ReturnsAsync((CourseGroup?)null);

        var result = await CreateController().GetById(99, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_WhenValid_ReturnsCreatedAtActionWithNewPkid()
    {
        var request = ValidRequest();
        _repo.Setup(r => r.CreateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync((short)7);
        _repo.Setup(r => r.GetByIdAsync((short)7, It.IsAny<CancellationToken>())).ReturnsAsync(SampleCourseGroup(7));

        var result = await CreateController().Create(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(CourseGroupsController.GetById), created.ActionName);
        Assert.Equal((short)7, created.RouteValues!["id"]);
        _repo.Verify(r => r.CreateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_WhenDescriptionMissing_ReturnsBadRequest()
    {
        var request = ValidRequest();
        request.Description = "";

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_WhenFound_ReturnsOkWithUpdatedCourseGroup()
    {
        var request = ValidRequest(1);
        request.Description = "資訊安全（已編輯）";
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _repo.Setup(r => r.GetByIdAsync((short)1, It.IsAny<CancellationToken>())).ReturnsAsync(SampleCourseGroup(1));

        var result = await CreateController().Update(request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.IsType<CourseGroup>(ok.Value);
        _repo.Verify(r => r.UpdateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Update_WhenMissing_ReturnsNotFound()
    {
        var request = ValidRequest(99);
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().Update(request, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Update_WhenDescriptionMissing_ReturnsBadRequest()
    {
        var request = ValidRequest(1);
        request.Description = "";

        var result = await CreateController().Update(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Delete ----

    [Fact]
    public async Task Delete_WhenFound_ReturnsNoContent()
    {
        _repo.Setup(r => r.DeleteAsync((short)1, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await CreateController().Delete(1, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task Delete_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.DeleteAsync((short)99, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().Delete(99, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }
}
