using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/publish-statuses")]
public class PublishStatusesController : ControllerBase
{
    private readonly IPublishStatusRepository _repository;

    public PublishStatusesController(IPublishStatusRepository repository) => _repository = repository;

    /// <summary>All publish statuses.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PublishStatus>>> GetAll(CancellationToken ct)
        => Ok(await _repository.GetAllAsync(ct));

    /// <summary>Filtered search.</summary>
    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<PublishStatus>>> Query([FromBody] PublishStatusQuery query, CancellationToken ct)
        => Ok(await _repository.QueryAsync(query, ct));

    /// <summary>Single status by pkid (user-assigned tinyint PK).</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<PublishStatus>> GetById(byte id, CancellationToken ct)
    {
        var status = await _repository.GetByIdAsync(id, ct);
        return status is null ? NotFound() : Ok(status);
    }

    /// <summary>Create a status. pkid is user-assigned and supplied in the body.</summary>
    [HttpPost]
    public async Task<ActionResult<PublishStatus>> Create([FromBody] PublishStatusRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest("Description is required.");

        if (await _repository.ExistsAsync(request.Pkid, ct))
            return Conflict($"PublishStatus pkid '{request.Pkid}' already exists.");

        await _repository.CreateAsync(request, ct);
        var created = await _repository.GetByIdAsync(request.Pkid, ct);
        return CreatedAtAction(nameof(GetById), new { id = request.Pkid }, created);
    }

    /// <summary>Update a status. pkid (key) is taken from the body.</summary>
    [HttpPut]
    public async Task<ActionResult<PublishStatus>> Update([FromBody] PublishStatusRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest("Description is required.");

        var updated = await _repository.UpdateAsync(request, ct);
        if (!updated) return NotFound();

        return Ok(await _repository.GetByIdAsync(request.Pkid, ct));
    }

    /// <summary>Delete a status by pkid.</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(byte id, CancellationToken ct)
    {
        var deleted = await _repository.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
