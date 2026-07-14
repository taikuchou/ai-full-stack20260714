using CMS.API.Controllers;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="PartnersController"/> covering the Partner endpoints:
/// list, filtered query, view, add, edit and delete. The repository is mocked so no database is required.
/// </summary>
public class PartnersControllerTests
{
    private readonly Mock<IPartnerRepository> _repo = new(MockBehavior.Strict);
    private PartnersController CreateController() => new(_repo.Object);

    private static Partner SamplePartner(short pkid = 1) => new()
    {
        Pkid = pkid,
        Name = "微軟",
        AppKey = "MS",
        NameOnPartnerMenu = "微軟認證課程",
        NameOnCourseDetailPage = "微軟",
        DisplayOrder = 10,
        ImageFilename = "ms.png"
    };

    private static PartnerRequest ValidRequest(short pkid = 0) => new()
    {
        Pkid = pkid,
        Name = "微軟",
        AppKey = "MS",
        NameOnPartnerMenu = "微軟認證課程",
        NameOnCourseDetailPage = "微軟",
        DisplayOrder = 10,
        ImageFilename = "ms.png"
    };

    // ---- List ----

    [Fact]
    public async Task GetAll_ReturnsOkWithAllPartners()
    {
        var partners = new[] { SamplePartner(1), SamplePartner(2) };
        _repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(partners);

        var result = await CreateController().GetAll(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<Partner>>(ok.Value);
        Assert.Equal(2, payload.Count());
    }

    // ---- Filtered query ----

    [Fact]
    public async Task Query_PassesQueryToRepository_AndReturnsMatches()
    {
        var query = new PartnerQuery { Keyword = "微軟", DisplayOrderFrom = 1, DisplayOrderTo = 100 };
        var matches = new[] { SamplePartner(1) };
        _repo.Setup(r => r.QueryAsync(query, It.IsAny<CancellationToken>())).ReturnsAsync(matches);

        var result = await CreateController().Query(query, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<Partner>>(ok.Value);
        Assert.Single(payload);
        _repo.Verify(r => r.QueryAsync(query, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_WhenFound_ReturnsOkWithPartner()
    {
        _repo.Setup(r => r.GetByIdAsync((short)1, It.IsAny<CancellationToken>())).ReturnsAsync(SamplePartner(1));

        var result = await CreateController().GetById(1, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var partner = Assert.IsType<Partner>(ok.Value);
        Assert.Equal((short)1, partner.Pkid);
    }

    [Fact]
    public async Task GetById_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.GetByIdAsync((short)99, It.IsAny<CancellationToken>())).ReturnsAsync((Partner?)null);

        var result = await CreateController().GetById(99, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_WhenValid_ReturnsCreatedAtActionWithNewPkid()
    {
        var request = ValidRequest();
        _repo.Setup(r => r.CreateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync((short)7);
        _repo.Setup(r => r.GetByIdAsync((short)7, It.IsAny<CancellationToken>())).ReturnsAsync(SamplePartner(7));

        var result = await CreateController().Create(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(PartnersController.GetById), created.ActionName);
        Assert.Equal((short)7, created.RouteValues!["id"]);
        _repo.Verify(r => r.CreateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_WhenNameMissing_ReturnsBadRequest()
    {
        var request = ValidRequest();
        request.Name = "";

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_WhenAppKeyMissing_ReturnsBadRequest()
    {
        var request = ValidRequest();
        request.AppKey = "";

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_WhenFound_ReturnsOkWithUpdatedPartner()
    {
        var request = ValidRequest(1);
        request.Name = "微軟（已編輯）";
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _repo.Setup(r => r.GetByIdAsync((short)1, It.IsAny<CancellationToken>())).ReturnsAsync(SamplePartner(1));

        var result = await CreateController().Update(request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.IsType<Partner>(ok.Value);
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
    public async Task Update_WhenNameOnCourseDetailPageMissing_ReturnsBadRequest()
    {
        var request = ValidRequest(1);
        request.NameOnCourseDetailPage = "";

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
