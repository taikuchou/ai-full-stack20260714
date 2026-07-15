using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CMS.API.Controllers;
using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="AuthController"/>'s login and profile endpoints. The repository is
/// mocked so no database is required; JWT issuance runs for real so claims and expiry can be verified.
/// </summary>
public class AuthControllerTests
{
    private const string SigningKey = "unit-test-symmetric-security-key-1234567890";

    private readonly Mock<IAuthRepository> _repo = new(MockBehavior.Strict);

    /// <param name="signedInUserId">
    /// When set, the controller runs with a ClaimsPrincipal carrying this NameIdentifier — standing
    /// in for the validated Bearer token that the real pipeline would have supplied.
    /// </param>
    private AuthController CreateController(string? signedInUserId = null)
    {
        var controller = new AuthController(_repo.Object);
        if (signedInUserId is not null)
        {
            var identity = new ClaimsIdentity(
                new[] { new Claim(ClaimTypes.NameIdentifier, signedInUserId) }, "TestAuth");
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
            };
        }
        return controller;
    }

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

    // ---- UpdateProfile ----

    private void SetupSuccessfulRename(string userId, params string[] roleIds)
    {
        _repo.Setup(r => r.UpdateUserNameAsync(userId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _repo.Setup(r => r.GetRoleIdsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(roleIds.ToList());
        _repo.Setup(r => r.GetSigningKeyAsync(It.IsAny<CancellationToken>())).ReturnsAsync(SigningKey);
    }

    [Fact]
    public async Task UpdateProfile_UpdatesUserNameForTheJwtUser()
    {
        SetupSuccessfulRename("helen", "Admin");

        var result = await CreateController(signedInUserId: "helen")
            .UpdateProfile(new UpdateProfileRequest { UserName = "Helen Wu" }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<UpdateProfileResponse>(ok.Value);
        Assert.Equal("helen", payload.UserId);
        Assert.Equal("Helen Wu", payload.UserName);
        _repo.Verify(r => r.UpdateUserNameAsync("helen", "Helen Wu", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateProfile_RenamesTheJwtUser_NotAnyoneNamedElsewhere()
    {
        // UpdateProfileRequest has no UserId to bind to, so the only account this can reach is the
        // token's. Signed in as 'miles' — 'helen' must not be touched, whatever the body said.
        SetupSuccessfulRename("miles");

        await CreateController(signedInUserId: "miles")
            .UpdateProfile(new UpdateProfileRequest { UserName = "Miles Sun" }, CancellationToken.None);

        _repo.Verify(r => r.UpdateUserNameAsync("miles", "Miles Sun", It.IsAny<CancellationToken>()), Times.Once);
        _repo.Verify(r => r.UpdateUserNameAsync("helen", It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateProfile_ReissuesTokenCarryingNewNameAndUnchangedRoles()
    {
        SetupSuccessfulRename("helen", "Editor");

        var result = await CreateController(signedInUserId: "helen")
            .UpdateProfile(new UpdateProfileRequest { UserName = "Helen Wu" }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<UpdateProfileResponse>(ok.Value);

        var token = new JwtSecurityTokenHandler().ReadJwtToken(payload.AccessToken);
        Assert.Equal("Helen Wu", token.Claims.Single(c => c.Type == ClaimTypes.Name).Value);
        Assert.Equal("helen", token.Claims.Single(c => c.Type == ClaimTypes.NameIdentifier).Value);

        // Roles come from the database, never from the request — a rename cannot widen them.
        Assert.Equal("Editor", Assert.Single(token.Claims, c => c.Type == ClaimTypes.Role).Value);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\n ")]
    public async Task UpdateProfile_WithEmptyOrWhitespaceUserName_ReturnsBadRequest(string userName)
    {
        // Strict mock: an unexpected repository call fails the test, so this also proves no write.
        var result = await CreateController(signedInUserId: "helen")
            .UpdateProfile(new UpdateProfileRequest { UserName = userName }, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task UpdateProfile_TrimsTheUserNameBeforeSaving()
    {
        SetupSuccessfulRename("helen");

        var result = await CreateController(signedInUserId: "helen")
            .UpdateProfile(new UpdateProfileRequest { UserName = "  Helen Wu  " }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal("Helen Wu", Assert.IsType<UpdateProfileResponse>(ok.Value).UserName);
        _repo.Verify(r => r.UpdateUserNameAsync("helen", "Helen Wu", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateProfile_WhenTokenUserNoLongerExists_ReturnsNotFound()
    {
        _repo.Setup(r => r.UpdateUserNameAsync("ghost", "Nobody", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await CreateController(signedInUserId: "ghost")
            .UpdateProfile(new UpdateProfileRequest { UserName = "Nobody" }, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    // ---- ChangePassword ----

    private const string CurrentPassword = "correct-password";
    private const string StrongNewPassword = "NewPassw0rd!";

    private static ChangePasswordRequest ChangeRequest(
        string current = CurrentPassword,
        string next = StrongNewPassword,
        string? confirm = null) => new()
    {
        CurrentPassword = current,
        NewPassword = next,
        ConfirmNewPassword = confirm ?? next,
    };

    /// <summary>Arranges the signed-in user's stored credential. Sets up no write by default.</summary>
    private void SetupCredentialFor(string userId = "helen", string password = CurrentPassword)
        => _repo.Setup(r => r.GetCredentialAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(SampleCredential(userId, password));

    /// <summary>
    /// SHA-256 uppercase hex computed independently of PasswordHasher. Asserting against
    /// PasswordHasher.Hash would be tautological — it would hold even if that switched to MD5.
    /// </summary>
    private static string Sha256Upper(string plain)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plain)));

    [Fact]
    public async Task ChangePassword_WithValidRequest_StoresSha256OfNewPasswordAndStampsUpdatedTime()
    {
        SetupCredentialFor();
        _repo.Setup(r => r.ChangePasswordAsync(
                "helen", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var before = DateTime.UtcNow;
        var result = await CreateController(signedInUserId: "helen")
            .ChangePassword(ChangeRequest(), CancellationToken.None);
        var after = DateTime.UtcNow;

        Assert.IsType<NoContentResult>(result);
        _repo.Verify(r => r.ChangePasswordAsync(
                "helen",
                Sha256Upper(StrongNewPassword),
                It.Is<DateTime>(t => t >= before && t <= after && t.Kind == DateTimeKind.Utc),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ChangePassword_StoredHashIsUppercaseSha256Hex_NotThePlaintext()
    {
        SetupCredentialFor();
        string? captured = null;
        _repo.Setup(r => r.ChangePasswordAsync(
                "helen", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, DateTime, CancellationToken>((_, hash, _, _) => captured = hash)
            .ReturnsAsync(true);

        await CreateController(signedInUserId: "helen").ChangePassword(ChangeRequest(), CancellationToken.None);

        Assert.NotNull(captured);
        Assert.DoesNotContain(StrongNewPassword, captured);
        Assert.Equal(64, captured!.Length);
        Assert.Equal(captured, captured.ToUpperInvariant());
    }

    [Fact]
    public async Task ChangePassword_WithWrongCurrentPassword_ChangesNothing()
    {
        SetupCredentialFor();

        var result = await CreateController(signedInUserId: "helen")
            .ChangePassword(ChangeRequest(current: "wrong-password"), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        // Strict mock would already fail on an unexpected call; assert the intent explicitly too.
        _repo.Verify(r => r.ChangePasswordAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ChangePassword_WithWrongCurrentPassword_DoesNotRevealTheComplexityRule()
    {
        SetupCredentialFor();

        // A weak new password AND a wrong current one: the current-password check must win, so a
        // caller probing with a wrong password learns nothing about the new one.
        var result = await CreateController(signedInUserId: "helen")
            .ChangePassword(ChangeRequest(current: "wrong-password", next: "abc"), CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.DoesNotContain(PasswordPolicy.ComplexityMessage, badRequest.Value!.ToString());
    }

    [Theory]
    // Too short (< 8), even with all four classes.
    [InlineData("Aa1!")]
    [InlineData("Aa1!bcd")]
    // Long enough, but only two classes.
    [InlineData("alllowercase")]
    [InlineData("ALLUPPERCASE")]
    [InlineData("lowerandupper")]
    [InlineData("lowercase123")]
    [InlineData("UPPERCASE123")]
    [InlineData("12345678!!")]
    public async Task ChangePassword_WithNonCompliantNewPassword_IsRejectedWithTheComplexityMessage(
        string weak)
    {
        SetupCredentialFor();

        var result = await CreateController(signedInUserId: "helen")
            .ChangePassword(ChangeRequest(next: weak), CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains(PasswordPolicy.ComplexityMessage, badRequest.Value!.ToString());
        _repo.Verify(r => r.ChangePasswordAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Theory]
    // Exactly 8 with exactly 3 classes — the boundary the rule allows.
    [InlineData("Passw0rd")]     // upper + lower + digit
    [InlineData("Password!")]    // upper + lower + symbol
    [InlineData("PASSW0RD!")]    // upper + digit + symbol
    [InlineData("passw0rd!")]    // lower + digit + symbol
    [InlineData("NewPassw0rd!")] // all four
    public async Task ChangePassword_WithCompliantNewPassword_IsAccepted(string strong)
    {
        SetupCredentialFor();
        _repo.Setup(r => r.ChangePasswordAsync(
                "helen", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await CreateController(signedInUserId: "helen")
            .ChangePassword(ChangeRequest(next: strong), CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task ChangePassword_WhenConfirmDoesNotMatch_ChangesNothing()
    {
        SetupCredentialFor();

        var result = await CreateController(signedInUserId: "helen")
            .ChangePassword(
                ChangeRequest(next: StrongNewPassword, confirm: "DifferentPassw0rd!"),
                CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        _repo.Verify(r => r.ChangePasswordAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ChangePassword_ConfirmComparisonIsCaseSensitive()
    {
        SetupCredentialFor();

        var result = await CreateController(signedInUserId: "helen")
            .ChangePassword(
                ChangeRequest(next: "NewPassw0rd!", confirm: "newpassw0rd!"),
                CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task ChangePassword_ChangesThePasswordOfTheJwtUser_NotAnyoneElse()
    {
        SetupCredentialFor("miles");
        _repo.Setup(r => r.ChangePasswordAsync(
                "miles", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        await CreateController(signedInUserId: "miles").ChangePassword(ChangeRequest(), CancellationToken.None);

        // The credential looked up is the token's, so no other account is reachable.
        _repo.Verify(r => r.GetCredentialAsync("miles", It.IsAny<CancellationToken>()), Times.Once);
        _repo.Verify(r => r.ChangePasswordAsync(
                "miles", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ChangePassword_WhenTokenUserNoLongerExists_ReturnsNotFound()
    {
        _repo.Setup(r => r.GetCredentialAsync("ghost", It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUserCredential?)null);

        var result = await CreateController(signedInUserId: "ghost")
            .ChangePassword(ChangeRequest(), CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task ChangePassword_ResponseCarriesNoHash()
    {
        SetupCredentialFor();
        _repo.Setup(r => r.ChangePasswordAsync(
                "helen", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await CreateController(signedInUserId: "helen")
            .ChangePassword(ChangeRequest(), CancellationToken.None);

        // 204 with no body at all — no hash can leak in either direction.
        Assert.IsType<NoContentResult>(result);
    }
}
