using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
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

        var authRepo = new Mock<IAuthRepository>();
        authRepo.Setup(r => r.GetSigningKeyAsync(It.IsAny<CancellationToken>())).ReturnsAsync(SigningKey);
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
}
