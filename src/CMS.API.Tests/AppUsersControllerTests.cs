using CMS.API.Controllers;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="AppUsersController"/> covering the AppUser endpoints:
/// list, filtered query, view, add, edit, delete and reset-password. The repository is mocked so
/// no database is required. Password hashing lives in the repository and is not exercised here.
/// </summary>
public class AppUsersControllerTests
{
    private readonly Mock<IAppUserRepository> _repo = new(MockBehavior.Strict);
    private AppUsersController CreateController() => new(_repo.Object);

    private static AppUser SampleUser(string userId = "helen") => new()
    {
        Pkid = 1,
        UserId = userId,
        UserName = "Helen Chen",
        IsActive = true,
        PasswordUpdatedTime = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        RoleCount = 2,
        RoleIds = new List<string> { "Admin", "Editor" }
    };

    // ---- List ----

    [Fact]
    public async Task GetAll_ReturnsOkWithAllUsers()
    {
        var users = new[] { SampleUser("helen"), SampleUser("miles") };
        _repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(users);

        var result = await CreateController().GetAll(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<AppUser>>(ok.Value);
        Assert.Equal(2, payload.Count());
    }

    // ---- Filtered query ----

    [Fact]
    public async Task Query_PassesQueryToRepository_AndReturnsMatches()
    {
        var query = new AppUserQuery { Keyword = "helen", IsActive = true };
        var matches = new[] { SampleUser("helen") };
        _repo.Setup(r => r.QueryAsync(query, It.IsAny<CancellationToken>())).ReturnsAsync(matches);

        var result = await CreateController().Query(query, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<AppUser>>(ok.Value);
        Assert.Single(payload);
        _repo.Verify(r => r.QueryAsync(query, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_WhenFound_ReturnsOkWithUser()
    {
        _repo.Setup(r => r.GetByIdAsync("helen", It.IsAny<CancellationToken>())).ReturnsAsync(SampleUser("helen"));

        var result = await CreateController().GetById("helen", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var user = Assert.IsType<AppUser>(ok.Value);
        Assert.Equal("helen", user.UserId);
        Assert.Equal(2, user.RoleIds.Count);
    }

    [Fact]
    public async Task GetById_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.GetByIdAsync("nope", It.IsAny<CancellationToken>())).ReturnsAsync((AppUser?)null);

        var result = await CreateController().GetById("nope", CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_WhenValidAndNew_ReturnsCreatedAtAction()
    {
        var request = new AppUserRequest
        {
            UserId = "miles",
            UserName = "Miles Sun",
            IsActive = true,
            RoleIds = new List<string> { "Editor" }
        };
        _repo.Setup(r => r.ExistsAsync("miles", It.IsAny<CancellationToken>())).ReturnsAsync(false);
        _repo.Setup(r => r.CreateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync("miles");
        _repo.Setup(r => r.GetByIdAsync("miles", It.IsAny<CancellationToken>())).ReturnsAsync(SampleUser("miles"));

        var result = await CreateController().Create(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(AppUsersController.GetById), created.ActionName);
        Assert.Equal("miles", created.RouteValues!["id"]);
        _repo.Verify(r => r.CreateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_WhenUserIdExists_ReturnsConflict()
    {
        var request = new AppUserRequest { UserId = "helen", UserName = "Helen Chen" };
        _repo.Setup(r => r.ExistsAsync("helen", It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result.Result);
        _repo.Verify(r => r.CreateAsync(It.IsAny<AppUserRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenUserIdMissing_ReturnsBadRequest()
    {
        var request = new AppUserRequest { UserId = "", UserName = "Helen Chen" };

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_WhenUserNameMissing_ReturnsBadRequest()
    {
        var request = new AppUserRequest { UserId = "helen", UserName = "" };

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_WhenFound_ReturnsOkWithUpdatedUser()
    {
        var request = new AppUserRequest
        {
            UserId = "helen",
            UserName = "Helen Chen (edited)",
            IsActive = false,
            RoleIds = new List<string> { "Admin" }
        };
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _repo.Setup(r => r.GetByIdAsync("helen", It.IsAny<CancellationToken>())).ReturnsAsync(SampleUser("helen"));

        var result = await CreateController().Update(request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.IsType<AppUser>(ok.Value);
        _repo.Verify(r => r.UpdateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Update_WhenMissing_ReturnsNotFound()
    {
        var request = new AppUserRequest { UserId = "ghost", UserName = "Ghost" };
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().Update(request, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Update_WhenUserNameMissing_ReturnsBadRequest()
    {
        var request = new AppUserRequest { UserId = "helen", UserName = "" };

        var result = await CreateController().Update(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Delete ----

    [Fact]
    public async Task Delete_WhenFound_ReturnsNoContent()
    {
        _repo.Setup(r => r.DeleteAsync("helen", It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await CreateController().Delete("helen", CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task Delete_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.DeleteAsync("ghost", It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().Delete("ghost", CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    // ---- Reset password ----

    [Fact]
    public async Task ResetPassword_WhenFound_ReturnsNoContent()
    {
        _repo.Setup(r => r.ResetPasswordAsync("helen", It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await CreateController().ResetPassword("helen", CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        _repo.Verify(r => r.ResetPasswordAsync("helen", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ResetPassword_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.ResetPasswordAsync("ghost", It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().ResetPassword("ghost", CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }
}
