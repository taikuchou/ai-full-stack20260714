using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Exercises the real HTTP pipeline (auth middleware included) via <see cref="WebApplicationFactory{Program}"/>.
/// <see cref="IAppRoleRepository"/> and <see cref="IAuthRepository"/> are swapped for mocks so no database
/// is required.
/// </summary>
public class AuthorizationIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string SigningKey = "integration-test-symmetric-security-key-1234567890";

    private readonly WebApplicationFactory<Program> _rawFactory;
    private readonly WebApplicationFactory<Program> _factory;

    /// <summary>The auth repository mock behind <see cref="_factory"/>, for verifying writes.</summary>
    private Mock<IAuthRepository> _authRepo = null!;

    /// <summary>The AppUser repository mock behind <see cref="_factory"/>.</summary>
    private Mock<IAppUserRepository> _appUserRepo = null!;

    public AuthorizationIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _rawFactory = factory;
        // Every test but the Auth:Disabled one runs with authorization enforced.
        _factory = CreateFactory(authDisabled: false);
    }

    /// <summary>
    /// Builds a factory with the repositories mocked and <c>Auth:Disabled</c> pinned.
    ///
    /// Pinning it is not optional: the test host runs in the Development environment, so it reads
    /// appsettings.Development.json — where the flag is on for local work. Left unpinned, these
    /// tests would pass while asserting nothing.
    /// </summary>
    private WebApplicationFactory<Program> CreateFactory(bool authDisabled)
    {
        var roleRepo = new Mock<IAppRoleRepository>();
        roleRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<AppRole>());

        // Stands in for the AppUser table. ResetPasswordAsync reads the default password from
        // SysConfig internally, so a mock at this level cannot observe the hash it writes — the
        // hashing itself is covered by AppUsersControllerTests / the repository's own SQL.
        var appUserRepo = new Mock<IAppUserRepository>();
        _appUserRepo = appUserRepo;
        appUserRepo.Setup(r => r.ResetPasswordAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var authRepo = new Mock<IAuthRepository>();
        _authRepo = authRepo;
        authRepo.Setup(r => r.GetSigningKeyAsync(It.IsAny<CancellationToken>())).ReturnsAsync(SigningKey);
        authRepo.Setup(r => r.UpdateUserNameAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        authRepo.Setup(r => r.ChangePasswordAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        authRepo.Setup(r => r.GetCredentialAsync("helen", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AppUserCredential
            {
                UserId = "helen",
                UserName = "Helen Chen",
                IsActive = true,
                PasswordHash = PasswordHasher.Hash("correct-password"),
            });
        authRepo.Setup(r => r.GetRoleIdsAsync("helen", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<string> { "Admin" });
        // A second, non-Admin account — used to prove a rename cannot reach another user's row.
        authRepo.Setup(r => r.GetRoleIdsAsync("miles", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<string> { "Editor" });

        return _rawFactory.WithWebHostBuilder(builder =>
        {
            // UseSetting lands in host configuration, which WebApplication.CreateBuilder reads
            // before the top-level statements run. ConfigureAppConfiguration would be too late:
            // its callbacks only apply at Build(), after Program.cs has read the flag.
            builder.UseSetting("Auth:Disabled", authDisabled ? "true" : "false");

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IAppRoleRepository>();
                services.AddScoped(_ => roleRepo.Object);

                services.RemoveAll<IAuthRepository>();
                services.AddScoped(_ => authRepo.Object);

                services.RemoveAll<IAppUserRepository>();
                services.AddScoped(_ => appUserRepo.Object);
            });
        });
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutBearerToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/approles");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithValidBearerToken_ReturnsOk()
    {
        var client = _factory.CreateClient();
        var token = JwtTokenGenerator.Generate(
            "helen", "Helen Chen", new[] { "Admin" }, SigningKey, TimeSpan.FromHours(1));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/approles");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithInvalidBearerToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-real-token");

        var response = await client.GetAsync("/api/approles");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithAuthDisabled_ServesRequestWithoutToken()
    {
        // The development escape hatch: Auth:Disabled drops the global AuthorizeFilter.
        var client = CreateFactory(authDisabled: true).CreateClient();

        var response = await client.GetAsync("/api/approles");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithoutBearerToken_StillReachesController_AndReturnsOk()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            UserId = "helen",
            Password = "correct-password",
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.Equal("helen", payload!.UserId);
        Assert.False(string.IsNullOrWhiteSpace(payload.AccessToken));
    }

    // ---- PUT /api/auth/profile ----

    private HttpClient CreateClientSignedInAs(string userId, string userName, params string[] roleIds)
    {
        var client = _factory.CreateClient();
        var token = JwtTokenGenerator.Generate(userId, userName, roleIds, SigningKey, TimeSpan.FromHours(1));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>
    /// The profile endpoint lives on AuthController, whose Login action is [AllowAnonymous]. This
    /// guards the regression where that attribute sits on the controller instead: AllowAnonymous
    /// short-circuits authorization for every action it covers, silently opening this endpoint.
    /// </summary>
    [Fact]
    public async Task UpdateProfile_WithoutBearerToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync("/api/auth/profile", new UpdateProfileRequest
        {
            UserName = "Anonymous Rename",
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        _authRepo.Verify(r => r.UpdateUserNameAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateProfile_WithValidBearerToken_RenamesTheTokenUser()
    {
        var client = CreateClientSignedInAs("helen", "Helen Chen", "Admin");

        var response = await client.PutAsJsonAsync("/api/auth/profile", new UpdateProfileRequest
        {
            UserName = "Helen Wu",
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<UpdateProfileResponse>();
        Assert.Equal("helen", payload!.UserId);
        Assert.Equal("Helen Wu", payload.UserName);
        _authRepo.Verify(r => r.UpdateUserNameAsync("helen", "Helen Wu", It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// Posts raw JSON carrying userId and roles — fields UpdateProfileRequest does not define — to
    /// prove the model binder drops them rather than letting a caller rename or elevate someone else.
    /// </summary>
    [Fact]
    public async Task UpdateProfile_IgnoresUserIdAndRolesInTheRequestBody()
    {
        var client = CreateClientSignedInAs("miles", "Miles Sun", "Editor");

        var body = new StringContent(
            """{"userId":"helen","userName":"Hijacked","roles":["Admin"]}""",
            Encoding.UTF8, "application/json");
        var response = await client.PutAsync("/api/auth/profile", body);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<UpdateProfileResponse>();

        // The body named helen; the token said miles. The token wins.
        Assert.Equal("miles", payload!.UserId);
        _authRepo.Verify(r => r.UpdateUserNameAsync("miles", "Hijacked", It.IsAny<CancellationToken>()), Times.Once);
        _authRepo.Verify(r => r.UpdateUserNameAsync("helen", It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);

        // Roles in the body are ignored too: the re-issued token carries Editor, from the database.
        var roles = new JwtSecurityTokenHandler().ReadJwtToken(payload.AccessToken)
            .Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value).ToList();
        Assert.Equal(new[] { "Editor" }, roles);
    }

    /// <summary>Same AllowAnonymous-placement guard as UpdateProfile — change-password must not be public.</summary>
    [Fact]
    public async Task ChangePassword_WithoutBearerToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/change-password", new ChangePasswordRequest
        {
            CurrentPassword = "correct-password",
            NewPassword = "NewPassw0rd!",
            ConfirmNewPassword = "NewPassw0rd!",
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        _authRepo.Verify(r => r.ChangePasswordAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ChangePassword_IgnoresUserIdInTheRequestBody()
    {
        var client = CreateClientSignedInAs("helen", "Helen Chen", "Admin");

        var body = new StringContent(
            """
            {"userId":"miles","currentPassword":"correct-password",
             "newPassword":"NewPassw0rd!","confirmNewPassword":"NewPassw0rd!"}
            """,
            Encoding.UTF8, "application/json");
        var response = await client.PostAsync("/api/auth/change-password", body);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        // The body named miles; the token said helen. The token wins.
        _authRepo.Verify(r => r.ChangePasswordAsync(
                "helen", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
        _authRepo.Verify(r => r.ChangePasswordAsync(
                "miles", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ---- POST /api/appusers/{id}/reset-password (Admin only) ----

    /// <summary>
    /// Exercises [Authorize(Roles = "Admin")] over the real pipeline. Worth an integration test
    /// rather than a unit one: role checks depend on the issued token's claim type lining up with
    /// the identity's RoleClaimType, which a mocked ClaimsPrincipal would paper over.
    /// </summary>
    [Fact]
    public async Task ResetPassword_AsAdmin_IsAllowed()
    {
        var client = CreateClientSignedInAs("helen", "Helen Chen", "Admin");

        var response = await client.PostAsync("/api/appusers/miles/reset-password", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        _appUserRepo.Verify(r => r.ResetPasswordAsync("miles", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ResetPassword_AsNonAdmin_ReturnsForbiddenAndResetsNothing()
    {
        var client = CreateClientSignedInAs("miles", "Miles Sun", "Editor");

        var response = await client.PostAsync("/api/appusers/helen/reset-password", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        _appUserRepo.Verify(r => r.ResetPasswordAsync(
            It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ResetPassword_WithNoRolesAtAll_ReturnsForbidden()
    {
        var client = CreateClientSignedInAs("nobody", "No Body");

        var response = await client.PostAsync("/api/appusers/helen/reset-password", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_WithoutBearerToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/api/appusers/helen/reset-password", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        _appUserRepo.Verify(r => r.ResetPasswordAsync(
            It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    /// <summary>403 is a refusal, not a leak — the body must not carry a password or hash.</summary>
    [Fact]
    public async Task ResetPassword_ReturnsNoPasswordOrHash_OnSuccessOrRefusal()
    {
        var admin = CreateClientSignedInAs("helen", "Helen Chen", "Admin");
        var editor = CreateClientSignedInAs("miles", "Miles Sun", "Editor");

        var success = await admin.PostAsync("/api/appusers/miles/reset-password", null);
        var refused = await editor.PostAsync("/api/appusers/helen/reset-password", null);

        foreach (var response in new[] { success, refused })
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.DoesNotContain("password", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("hash", body, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task UpdateProfile_WithWhitespaceUserName_ReturnsBadRequestAndWritesNothing()
    {
        var client = CreateClientSignedInAs("helen", "Helen Chen", "Admin");

        var response = await client.PutAsJsonAsync("/api/auth/profile", new UpdateProfileRequest
        {
            UserName = "   ",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        _authRepo.Verify(r => r.UpdateUserNameAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
