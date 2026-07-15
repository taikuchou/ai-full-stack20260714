using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Exercises the unhandled-exception path over the real HTTP pipeline.
/// <para>
/// The test host runs in the Development environment, where WebApplication auto-adds the developer
/// exception page — so these tests also prove that page never gets to render its stack trace.
/// </para>
/// </summary>
public class GlobalExceptionHandlerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string SigningKey = "integration-test-symmetric-security-key-1234567890";

    /// <summary>Shaped like a real SqlException message: names a table and echoes SQL.</summary>
    private const string LeakyExceptionMessage =
        "Invalid column name 'Secret'. SELECT PasswordHash FROM AppUser WHERE UserId = 'helen'";

    private readonly WebApplicationFactory<Program> _rawFactory;

    public GlobalExceptionHandlerTests(WebApplicationFactory<Program> factory) => _rawFactory = factory;

    /// <param name="throws">When set, GET /api/approles blows up instead of returning data.</param>
    private WebApplicationFactory<Program> CreateFactory(bool throws)
    {
        var roleRepo = new Mock<IAppRoleRepository>();
        if (throws)
        {
            roleRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException(LeakyExceptionMessage));
        }
        else
        {
            roleRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<AppRole>());
        }

        var authRepo = new Mock<IAuthRepository>();
        authRepo.Setup(r => r.GetSigningKeyAsync(It.IsAny<CancellationToken>())).ReturnsAsync(SigningKey);

        return _rawFactory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Auth:Disabled", "false");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IAppRoleRepository>();
                services.AddScoped(_ => roleRepo.Object);
                services.RemoveAll<IAuthRepository>();
                services.AddScoped(_ => authRepo.Object);
            });
        });
    }

    private HttpClient CreateSignedInClient(bool throws = true)
    {
        var client = CreateFactory(throws).CreateClient(new WebApplicationFactoryClientOptions
        {
            // Let the 500 come back as a response instead of being rethrown into the test.
            AllowAutoRedirect = false,
        });
        var token = JwtTokenGenerator.Generate(
            "helen", "Helen Chen", new[] { "Admin" }, SigningKey, TimeSpan.FromHours(1));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task UnhandledException_ReturnsInternalServerError()
    {
        var response = await CreateSignedInClient().GetAsync("/api/approles");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    [Fact]
    public async Task UnhandledException_LeaksNoExceptionDetailSqlOrStackTrace()
    {
        var response = await CreateSignedInClient().GetAsync("/api/approles");

        var body = await response.Content.ReadAsStringAsync();

        // The exception's own message — the part that carries table names and SQL.
        Assert.DoesNotContain("Invalid column name", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("PasswordHash", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("SELECT", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("AppUser", body, StringComparison.OrdinalIgnoreCase);
        // Exception type and stack trace.
        Assert.DoesNotContain("InvalidOperationException", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("StackTrace", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("   at ", body, StringComparison.Ordinal);
        Assert.DoesNotContain("CMS.API.Controllers", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UnhandledException_ReturnsAFriendlyGenericBodyWithATraceId()
    {
        var response = await CreateSignedInClient().GetAsync("/api/approles");

        var body = await response.Content.ReadAsStringAsync();

        Assert.Contains("Server error", body, StringComparison.OrdinalIgnoreCase);
        // The safe half: lets a user's report be matched to the logged detail.
        Assert.Contains("traceId", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UnhandledException_RespondsAsJsonProblemDetails()
    {
        var response = await CreateSignedInClient().GetAsync("/api/approles");

        Assert.Contains("json", response.Content.Headers.ContentType?.MediaType ?? "");
    }

    // ---- Deliberate responses must be untouched ----

    [Fact]
    public async Task WithoutBearerToken_StillReturnsUnauthorizedNot500()
    {
        var client = CreateFactory(throws: true).CreateClient();

        var response = await client.GetAsync("/api/approles");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ValidationFailure_StillReturnsBadRequestWithItsOwnMessage()
    {
        var client = CreateSignedInClient(throws: false);

        // Name is required — the controller's own 400, not an exception.
        var response = await client.PostAsJsonAsync("/api/partners", new PartnerRequest
        {
            Name = "",
            AppKey = "MS",
            NameOnPartnerMenu = "menu",
            NameOnCourseDetailPage = "detail",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Name", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SuccessfulRequest_IsUnaffected()
    {
        var client = CreateSignedInClient(throws: false);

        var response = await client.GetAsync("/api/approles");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
