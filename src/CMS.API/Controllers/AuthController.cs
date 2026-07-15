using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

// The only controller reachable without a Bearer token — every other controller requires
// authentication via the global AuthorizeFilter registered in Program.cs.
[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public class AuthController : ControllerBase
{
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromHours(24);

    private readonly IAuthRepository _repository;

    public AuthController(IAuthRepository repository) => _repository = repository;

    /// <summary>Verifies UserId/Password against AppUser and, on success, issues a JWT access token.</summary>
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
}
