using System.Security.Claims;
using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

// Authorization here is per-action, not per-controller: [AllowAnonymous] sits on Login alone.
// It must NOT move up to the class — AllowAnonymous short-circuits authorization for every action
// it covers, and an action-level [Authorize] cannot win it back, so a class-level attribute would
// silently leave UpdateProfile open to anonymous callers.
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromHours(24);

    private readonly IAuthRepository _repository;

    public AuthController(IAuthRepository repository) => _repository = repository;

    /// <summary>Verifies UserId/Password against AppUser and, on success, issues a JWT access token.</summary>
    // Anonymous by necessity: login is what issues the token, so it cannot demand one.
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var credential = await _repository.GetCredentialAsync(request.UserId, ct);
        var passwordHash = PasswordHasher.Hash(request.Password);

        // Generic failure for unknown user, wrong password and inactive account alike —
        // never reveal which check failed.
        if (credential is null || !credential.IsActive || credential.PasswordHash != passwordHash)
            return Unauthorized(new { message = "Invalid credentials." });

        var roleIds = await _repository.GetRoleIdsAsync(credential.UserId, ct);
        var signingKey = await _repository.GetSigningKeyAsync(ct);
        var accessToken = JwtTokenGenerator.Generate(
            credential.UserId, credential.UserName, roleIds, signingKey, TokenLifetime);

        return Ok(new LoginResponse
        {
            UserId = credential.UserId,
            UserName = credential.UserName,
            AccessToken = accessToken,
        });
    }

    /// <summary>Renames the calling user. UserName is the only field a user may change about themselves.</summary>
    [HttpPut("profile")]
    public async Task<ActionResult<UpdateProfileResponse>> UpdateProfile(
        [FromBody] UpdateProfileRequest request, CancellationToken ct)
    {
        // The account being renamed is taken from the validated token, never the request body.
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var userName = request.UserName?.Trim() ?? string.Empty;
        if (userName.Length == 0)
            return BadRequest(new { message = "UserName is required." });

        // Renames only the UserName column, so IsActive / PasswordHash / roles are unreachable here.
        if (!await _repository.UpdateUserNameAsync(userId, userName, ct))
            return NotFound();

        // Re-issue the token so its Name claim matches the new UserName. Roles are re-read from the
        // database rather than carried over from the caller's token, so a rename can never widen them.
        var roleIds = await _repository.GetRoleIdsAsync(userId, ct);
        var signingKey = await _repository.GetSigningKeyAsync(ct);
        var accessToken = JwtTokenGenerator.Generate(userId, userName, roleIds, signingKey, TokenLifetime);

        return Ok(new UpdateProfileResponse
        {
            UserId = userId,
            UserName = userName,
            AccessToken = accessToken,
        });
    }

    /// <summary>Changes the calling user's own password after verifying their current one.</summary>
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        // The account is taken from the validated token, never the request body.
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var credential = await _repository.GetCredentialAsync(userId, ct);
        if (credential is null)
            return NotFound();

        // 1. Verify the current password before anything else — a wrong one changes nothing.
        if (credential.PasswordHash != PasswordHasher.Hash(request.CurrentPassword ?? string.Empty))
            return BadRequest(new { message = "目前密碼不正確 (Current password is incorrect.)" });

        // 2. Complexity. Checked before the confirm match so a caller retyping a weak password
        //    consistently still gets told the real problem.
        if (!PasswordPolicy.IsCompliant(request.NewPassword))
            return BadRequest(new { message = PasswordPolicy.ComplexityMessage });

        // 3. New and confirm must match. Ordinal: passwords compare by exact code units.
        if (!string.Equals(request.NewPassword, request.ConfirmNewPassword, StringComparison.Ordinal))
            return BadRequest(new { message = "新密碼與確認密碼不一致 (New password and confirmation do not match.)" });

        // 4. Store the new hash and stamp the change.
        var newHash = PasswordHasher.Hash(request.NewPassword);
        if (!await _repository.ChangePasswordAsync(userId, newHash, DateTime.UtcNow, ct))
            return NotFound();

        // 204: nothing to return, and deliberately no hash in either direction.
        return NoContent();
    }
}
