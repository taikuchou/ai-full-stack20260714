using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/approles")]
public class AppRolesController : ControllerBase
{
    private readonly IAppRoleRepository _repository;

    public AppRolesController(IAppRoleRepository repository) => _repository = repository;

    /// <summary>All roles.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AppRole>>> GetAll(CancellationToken ct)
        => Ok(await _repository.GetAllAsync(ct));

    /// <summary>Filtered search.</summary>
    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<AppRole>>> Query([FromBody] AppRoleQuery query, CancellationToken ct)
        => Ok(await _repository.QueryAsync(query, ct));

    /// <summary>Single role by RoleId (string PK).</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<AppRole>> GetById(string id, CancellationToken ct)
    {
        var role = await _repository.GetByIdAsync(id, ct);
        return role is null ? NotFound() : Ok(role);
    }

    /// <summary>Create a role.</summary>
    [HttpPost]
    public async Task<ActionResult<AppRole>> Create([FromBody] AppRoleRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.RoleId))
            return BadRequest("RoleId is required.");
        if (string.IsNullOrWhiteSpace(request.RoleName))
            return BadRequest("RoleName is required.");

        if (await _repository.ExistsAsync(request.RoleId, ct))
            return Conflict($"RoleId '{request.RoleId}' already exists.");

        await _repository.CreateAsync(request, ct);
        var created = await _repository.GetByIdAsync(request.RoleId, ct);
        return CreatedAtAction(nameof(GetById), new { id = request.RoleId }, created);
    }

    /// <summary>Update a role. RoleId (key) is taken from the body.</summary>
    [HttpPut]
    public async Task<ActionResult<AppRole>> Update([FromBody] AppRoleRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.RoleId))
            return BadRequest("RoleId is required.");
        if (string.IsNullOrWhiteSpace(request.RoleName))
            return BadRequest("RoleName is required.");

        var updated = await _repository.UpdateAsync(request, ct);
        if (!updated) return NotFound();

        return Ok(await _repository.GetByIdAsync(request.RoleId, ct));
    }

    /// <summary>Delete a role by RoleId.</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        var deleted = await _repository.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
