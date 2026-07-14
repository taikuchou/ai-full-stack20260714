using CMS.API.Controllers;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="AppRolesController"/> covering the AppRole endpoints:
/// list, filtered query, view, add and edit. The repository is mocked so no database is required.
/// </summary>
public class AppRolesControllerTests
{
    private readonly Mock<IAppRoleRepository> _repo = new(MockBehavior.Strict);
    private AppRolesController CreateController() => new(_repo.Object);

    private static AppRole SampleRole(string roleId = "Admin") => new()
    {
        Pkid = 1,
        RoleId = roleId,
        RoleName = "Administrator",
        PermissionLevel = 1,
        Description = "系統管理員",
        UserCount = 3,
        UserIds = new List<string> { "helen", "Jenny_Tsao" }
    };

    // ---- List ----

    [Fact]
    public async Task GetAll_ReturnsOkWithAllRoles()
    {
        var roles = new[] { SampleRole("Admin"), SampleRole("User") };
        _repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(roles);

        var result = await CreateController().GetAll(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<AppRole>>(ok.Value);
        Assert.Equal(2, payload.Count());
    }

    // ---- Filtered query ----

    [Fact]
    public async Task Query_PassesQueryToRepository_AndReturnsMatches()
    {
        var query = new AppRoleQuery { Keyword = "Admin", PermissionLevelFrom = 1, PermissionLevelTo = 50 };
        var matches = new[] { SampleRole("Admin") };
        _repo.Setup(r => r.QueryAsync(query, It.IsAny<CancellationToken>())).ReturnsAsync(matches);

        var result = await CreateController().Query(query, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<AppRole>>(ok.Value);
        Assert.Single(payload);
        _repo.Verify(r => r.QueryAsync(query, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_WhenFound_ReturnsOkWithRole()
    {
        _repo.Setup(r => r.GetByIdAsync("Admin", It.IsAny<CancellationToken>())).ReturnsAsync(SampleRole("Admin"));

        var result = await CreateController().GetById("Admin", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var role = Assert.IsType<AppRole>(ok.Value);
        Assert.Equal("Admin", role.RoleId);
        Assert.Equal(2, role.UserIds.Count);
    }

    [Fact]
    public async Task GetById_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.GetByIdAsync("Nope", It.IsAny<CancellationToken>())).ReturnsAsync((AppRole?)null);

        var result = await CreateController().GetById("Nope", CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_WhenValidAndNew_ReturnsCreatedAtAction()
    {
        var request = new AppRoleRequest
        {
            RoleId = "Editor",
            RoleName = "Editor",
            PermissionLevel = 50,
            Description = "編輯",
            UserIds = new List<string> { "helen" }
        };
        _repo.Setup(r => r.ExistsAsync("Editor", It.IsAny<CancellationToken>())).ReturnsAsync(false);
        _repo.Setup(r => r.CreateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync("Editor");
        _repo.Setup(r => r.GetByIdAsync("Editor", It.IsAny<CancellationToken>())).ReturnsAsync(SampleRole("Editor"));

        var result = await CreateController().Create(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(AppRolesController.GetById), created.ActionName);
        Assert.Equal("Editor", created.RouteValues!["id"]);
        _repo.Verify(r => r.CreateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_WhenRoleIdExists_ReturnsConflict()
    {
        var request = new AppRoleRequest { RoleId = "Admin", RoleName = "Administrator" };
        _repo.Setup(r => r.ExistsAsync("Admin", It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result.Result);
        _repo.Verify(r => r.CreateAsync(It.IsAny<AppRoleRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenRoleIdMissing_ReturnsBadRequest()
    {
        var request = new AppRoleRequest { RoleId = "", RoleName = "Administrator" };

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_WhenFound_ReturnsOkWithUpdatedRole()
    {
        var request = new AppRoleRequest
        {
            RoleId = "Admin",
            RoleName = "Administrator (edited)",
            PermissionLevel = 1,
            Description = "系統管理員",
            UserIds = new List<string> { "helen", "Miles" }
        };
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _repo.Setup(r => r.GetByIdAsync("Admin", It.IsAny<CancellationToken>())).ReturnsAsync(SampleRole("Admin"));

        var result = await CreateController().Update(request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.IsType<AppRole>(ok.Value);
        _repo.Verify(r => r.UpdateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Update_WhenMissing_ReturnsNotFound()
    {
        var request = new AppRoleRequest { RoleId = "Ghost", RoleName = "Ghost" };
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().Update(request, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Update_WhenRoleNameMissing_ReturnsBadRequest()
    {
        var request = new AppRoleRequest { RoleId = "Admin", RoleName = "" };

        var result = await CreateController().Update(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Delete ----

    [Fact]
    public async Task Delete_WhenFound_ReturnsNoContent()
    {
        _repo.Setup(r => r.DeleteAsync("Admin", It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await CreateController().Delete("Admin", CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task Delete_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.DeleteAsync("Ghost", It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().Delete("Ghost", CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }
}
