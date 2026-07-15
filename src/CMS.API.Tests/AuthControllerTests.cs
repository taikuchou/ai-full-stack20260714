using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using CMS.API.Controllers;
using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="AuthController"/>'s login endpoint. The repository is mocked so no
/// database is required; JWT issuance runs for real so claims and expiry can be verified.
/// </summary>
public class AuthControllerTests
{
    private const string SigningKey = "unit-test-symmetric-security-key-1234567890";

    private readonly Mock<IAuthRepository> _repo = new(MockBehavior.Strict);
    private AuthController CreateController() => new(_repo.Object);

    private static AppUserCredential SampleCredential(
        string userId = "helen", string password = "correct-password", bool isActive = true) => new()
    {
        UserId = userId,
        UserName = "Helen Chen",
        IsActive = isActive,
        PasswordHash = PasswordHasher.Hash(password)
    };

    private static LoginRequest SampleRequest(string userId = "helen", string password = "correct-password")
        => new() { UserId = userId, Password = password };

    // ---- Success ----

    [Fact]
    public async Task Login_WithValidActiveUser_ReturnsOkWithAccessToken()
    {
        var roleIds = new List<string> { "Admin", "Editor" };
        _repo.Setup(r => r.GetCredentialAsync("helen", It.IsAny<CancellationToken>()))
            .ReturnsAsync(SampleCredential());
        _repo.Setup(r => r.GetRoleIdsAsync("helen", It.IsAny<CancellationToken>())).ReturnsAsync(roleIds);
        _repo.Setup(r => r.GetSigningKeyAsync(It.IsAny<CancellationToken>())).ReturnsAsync(SigningKey);

        var result = await CreateController().Login(SampleRequest(), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<LoginResponse>(ok.Value);
        Assert.Equal("helen", payload.UserId);
        Assert.Equal("Helen Chen", payload.UserName);
        Assert.False(string.IsNullOrWhiteSpace(payload.AccessToken));
    }

    [Fact]
    public async Task Login_IssuedToken_CarriesUserIdUserNameRoleClaimsAndExpiresIn24Hours()
    {
        var roleIds = new List<string> { "Admin", "Editor" };
        _repo.Setup(r => r.GetCredentialAsync("helen", It.IsAny<CancellationToken>()))
            .ReturnsAsync(SampleCredential());
        _repo.Setup(r => r.GetRoleIdsAsync("helen", It.IsAny<CancellationToken>())).ReturnsAsync(roleIds);
        _repo.Setup(r => r.GetSigningKeyAsync(It.IsAny<CancellationToken>())).ReturnsAsync(SigningKey);

        var beforeIssue = DateTime.UtcNow;
        var result = await CreateController().Login(SampleRequest(), CancellationToken.None);
        var afterIssue = DateTime.UtcNow;

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<LoginResponse>(ok.Value);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(payload.AccessToken);

        Assert.Equal("helen", jwt.Claims.Single(c => c.Type == ClaimTypes.NameIdentifier).Value);
        Assert.Equal("Helen Chen", jwt.Claims.Single(c => c.Type == ClaimTypes.Name).Value);
        var claimedRoles = jwt.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value).ToList();
        Assert.Equivalent(roleIds, claimedRoles);

        Assert.InRange(jwt.ValidTo, beforeIssue.AddHours(24).AddSeconds(-5), afterIssue.AddHours(24).AddSeconds(5));
    }

    // ---- Failure: generic 401, never reveals which check failed ----

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorized()
    {
        _repo.Setup(r => r.GetCredentialAsync("helen", It.IsAny<CancellationToken>()))
            .ReturnsAsync(SampleCredential());

        var result = await CreateController().Login(
            SampleRequest(password: "wrong-password"), CancellationToken.None);

        Assert.IsType<UnauthorizedObjectResult>(result.Result);
        _repo.Verify(r => r.GetRoleIdsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _repo.Verify(r => r.GetSigningKeyAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Login_WithUnknownUserId_ReturnsUnauthorized()
    {
        _repo.Setup(r => r.GetCredentialAsync("ghost", It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUserCredential?)null);

        var result = await CreateController().Login(SampleRequest(userId: "ghost"), CancellationToken.None);

        Assert.IsType<UnauthorizedObjectResult>(result.Result);
        _repo.Verify(r => r.GetRoleIdsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _repo.Verify(r => r.GetSigningKeyAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Login_WithInactiveUser_ReturnsUnauthorized()
    {
        _repo.Setup(r => r.GetCredentialAsync("helen", It.IsAny<CancellationToken>()))
            .ReturnsAsync(SampleCredential(isActive: false));

        var result = await CreateController().Login(SampleRequest(), CancellationToken.None);

        Assert.IsType<UnauthorizedObjectResult>(result.Result);
        _repo.Verify(r => r.GetRoleIdsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _repo.Verify(r => r.GetSigningKeyAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    // ---- PasswordHash must never reach the client ----

    [Fact]
    public async Task Login_ResponseNeverContainsPasswordHash()
    {
        var credential = SampleCredential();
        _repo.Setup(r => r.GetCredentialAsync("helen", It.IsAny<CancellationToken>())).ReturnsAsync(credential);
        _repo.Setup(r => r.GetRoleIdsAsync("helen", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<string>());
        _repo.Setup(r => r.GetSigningKeyAsync(It.IsAny<CancellationToken>())).ReturnsAsync(SigningKey);

        var result = await CreateController().Login(SampleRequest(), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<LoginResponse>(ok.Value);

        // LoginResponse has no PasswordHash property at all — assert it can't leak via any field.
        Assert.DoesNotContain(credential.PasswordHash, payload.AccessToken);
        Assert.DoesNotContain(credential.PasswordHash, payload.UserId);
        Assert.DoesNotContain(credential.PasswordHash, payload.UserName);
    }
}
