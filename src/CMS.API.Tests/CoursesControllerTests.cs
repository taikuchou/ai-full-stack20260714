using CMS.API.Controllers;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="CoursesController"/> covering the Course endpoints:
/// list, filtered query, view, add, edit and delete. The repository is mocked so no database is required.
/// </summary>
public class CoursesControllerTests
{
    private readonly Mock<ICourseRepository> _repo = new(MockBehavior.Strict);
    private CoursesController CreateController() => new(_repo.Object);

    private static Course SampleCourse(int pkid = 1) => new()
    {
        Pkid = pkid,
        Title = "Azure 基礎課程",
        OfficialTitle = "Microsoft Azure Fundamentals",
        CourseId = "AZ-900",
        ProdCourseId = "PROD-AZ900",
        FriendlyUrl = "azure-fundamentals",
        DisplayOrder = 10,
        Partner_pkid = 1,
        CourseGroup_pkid = 2,
        PublishStatus_pkid = 1,
        PartnerName = "微軟",
        CourseGroupDescription = "雲端課程",
        PublishStatusDescription = "已發布",
        ScheduleOn = new DateOnly(2026, 1, 1),
        ScheduleOff = new DateOnly(2036, 1, 1),
        Hour = 8,
        ListPrice = 12000,
        LearningCredit = 3.0m,
        CanRepeat = true,
        CertificationCount = 1,
        JobCategoryCount = 2,
        CertificationPkids = [5],
        JobCategoryPkids = [3, 4]
    };

    private static CourseRequest ValidRequest(int pkid = 0) => new()
    {
        Pkid = pkid,
        Title = "Azure 基礎課程",
        OfficialTitle = "Microsoft Azure Fundamentals",
        CourseId = "AZ-900",
        ProdCourseId = "PROD-AZ900",
        FriendlyUrl = "azure-fundamentals",
        DisplayOrder = 10,
        Partner_pkid = 1,
        CourseGroup_pkid = 2,
        PublishStatus_pkid = 1,
        ScheduleOn = new DateOnly(2026, 1, 1),
        ScheduleOff = new DateOnly(2036, 1, 1),
        Hour = 8,
        ListPrice = 12000,
        LearningCredit = 3.0m,
        CanRepeat = true,
        CertificationPkids = [5],
        JobCategoryPkids = [3, 4]
    };

    // ---- List ----

    [Fact]
    public async Task GetAll_ReturnsOkWithAllCourses()
    {
        var courses = new[] { SampleCourse(1), SampleCourse(2) };
        _repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(courses);

        var result = await CreateController().GetAll(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<Course>>(ok.Value);
        Assert.Equal(2, payload.Count());
    }

    // ---- Filtered query ----

    [Fact]
    public async Task Query_PassesQueryToRepository_AndReturnsMatches()
    {
        var query = new CourseQuery { Keyword = "Azure", PartnerPkid = 1, PublishStatusPkid = 1, CanRepeat = true };
        var matches = new[] { SampleCourse(1) };
        _repo.Setup(r => r.QueryAsync(query, It.IsAny<CancellationToken>())).ReturnsAsync(matches);

        var result = await CreateController().Query(query, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<Course>>(ok.Value);
        Assert.Single(payload);
        _repo.Verify(r => r.QueryAsync(query, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_WhenFound_ReturnsOkWithCourse()
    {
        _repo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(SampleCourse(1));

        var result = await CreateController().GetById(1, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var course = Assert.IsType<Course>(ok.Value);
        Assert.Equal(1, course.Pkid);
        Assert.Equal([5], course.CertificationPkids);
    }

    [Fact]
    public async Task GetById_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.GetByIdAsync(99, It.IsAny<CancellationToken>())).ReturnsAsync((Course?)null);

        var result = await CreateController().GetById(99, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_WhenValid_ReturnsCreatedAtActionWithNewPkid()
    {
        var request = ValidRequest();
        _repo.Setup(r => r.CreateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(7);
        _repo.Setup(r => r.GetByIdAsync(7, It.IsAny<CancellationToken>())).ReturnsAsync(SampleCourse(7));

        var result = await CreateController().Create(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(CoursesController.GetById), created.ActionName);
        Assert.Equal(7, created.RouteValues!["id"]);
        _repo.Verify(r => r.CreateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_WhenTitleMissing_ReturnsBadRequest()
    {
        var request = ValidRequest();
        request.Title = "";

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_WhenCourseIdMissing_ReturnsBadRequest()
    {
        var request = ValidRequest();
        request.CourseId = "";

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_WhenFound_ReturnsOkWithUpdatedCourse()
    {
        var request = ValidRequest(1);
        request.Title = "Azure 基礎課程（已編輯）";
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _repo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(SampleCourse(1));

        var result = await CreateController().Update(request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.IsType<Course>(ok.Value);
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
    public async Task Update_WhenFriendlyUrlMissing_ReturnsBadRequest()
    {
        var request = ValidRequest(1);
        request.FriendlyUrl = "";

        var result = await CreateController().Update(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Delete ----

    [Fact]
    public async Task Delete_WhenFound_ReturnsNoContent()
    {
        _repo.Setup(r => r.DeleteAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await CreateController().Delete(1, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task Delete_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.DeleteAsync(99, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().Delete(99, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }
}
