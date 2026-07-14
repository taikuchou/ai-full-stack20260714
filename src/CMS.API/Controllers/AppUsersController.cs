using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/appusers")]
public class AppUsersController : ControllerBase
{
    private readonly IAppUserRepository _repository;

    public AppUsersController(IAppUserRepository repository) => _repository = repository;

    /// <summary>All users.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AppUser>>> GetAll(CancellationToken ct)
        => Ok(await _repository.GetAllAsync(ct));

    /// <summary>Filtered search.</summary>
    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<AppUser>>> Query([FromBody] AppUserQuery query, CancellationToken ct)
        => Ok(await _repository.QueryAsync(query, ct));

    /// <summary>Single user by UserId (string PK).</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<AppUser>> GetById(string id, CancellationToken ct)
    {
        var user = await _repository.GetByIdAsync(id, ct);
        return user is null ? NotFound() : Ok(user);
    }

    /// <summary>Create a user. The initial password is set server-side from the configured default.</summary>
    [HttpPost]
    public async Task<ActionResult<AppUser>> Create([FromBody] AppUserRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.UserId))
            return BadRequest("UserId is required.");
        if (string.IsNullOrWhiteSpace(request.UserName))
            return BadRequest("UserName is required.");

        if (await _repository.ExistsAsync(request.UserId, ct))
            return Conflict($"UserId '{request.UserId}' already exists.");

        await _repository.CreateAsync(request, ct);
        var created = await _repository.GetByIdAsync(request.UserId, ct);
        return CreatedAtAction(nameof(GetById), new { id = request.UserId }, created);
    }

    /// <summary>Update a user. UserId (key) is taken from the body. The password is never modified here.</summary>
    [HttpPut]
    public async Task<ActionResult<AppUser>> Update([FromBody] AppUserRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.UserId))
            return BadRequest("UserId is required.");
        if (string.IsNullOrWhiteSpace(request.UserName))
            return BadRequest("UserName is required.");

        var updated = await _repository.UpdateAsync(request, ct);
        if (!updated) return NotFound();

        return Ok(await _repository.GetByIdAsync(request.UserId, ct));
    }

    /// <summary>Delete a user by UserId.</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        var deleted = await _repository.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    /// <summary>Reset the user's password to the configured default.</summary>
    [HttpPost("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(string id, CancellationToken ct)
    {
        var reset = await _repository.ResetPasswordAsync(id, ct);
        return reset ? NoContent() : NotFound();
    }
}
