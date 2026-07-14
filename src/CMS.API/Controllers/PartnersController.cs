using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/partners")]
public class PartnersController : ControllerBase
{
    private readonly IPartnerRepository _repository;

    public PartnersController(IPartnerRepository repository) => _repository = repository;

    /// <summary>All partners.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Partner>>> GetAll(CancellationToken ct)
        => Ok(await _repository.GetAllAsync(ct));

    /// <summary>Filtered search.</summary>
    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<Partner>>> Query([FromBody] PartnerQuery query, CancellationToken ct)
        => Ok(await _repository.QueryAsync(query, ct));

    /// <summary>Single partner by pkid.</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<Partner>> GetById(short id, CancellationToken ct)
    {
        var partner = await _repository.GetByIdAsync(id, ct);
        return partner is null ? NotFound() : Ok(partner);
    }

    /// <summary>Create a partner. pkid is assigned by the database.</summary>
    [HttpPost]
    public async Task<ActionResult<Partner>> Create([FromBody] PartnerRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");
        if (string.IsNullOrWhiteSpace(request.AppKey))
            return BadRequest("AppKey is required.");
        if (string.IsNullOrWhiteSpace(request.NameOnPartnerMenu))
            return BadRequest("NameOnPartnerMenu is required.");
        if (string.IsNullOrWhiteSpace(request.NameOnCourseDetailPage))
            return BadRequest("NameOnCourseDetailPage is required.");

        var newId = await _repository.CreateAsync(request, ct);
        var created = await _repository.GetByIdAsync(newId, ct);
        return CreatedAtAction(nameof(GetById), new { id = newId }, created);
    }

    /// <summary>Update a partner. pkid (key) is taken from the body.</summary>
    [HttpPut]
    public async Task<ActionResult<Partner>> Update([FromBody] PartnerRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");
        if (string.IsNullOrWhiteSpace(request.AppKey))
            return BadRequest("AppKey is required.");
        if (string.IsNullOrWhiteSpace(request.NameOnPartnerMenu))
            return BadRequest("NameOnPartnerMenu is required.");
        if (string.IsNullOrWhiteSpace(request.NameOnCourseDetailPage))
            return BadRequest("NameOnCourseDetailPage is required.");

        var updated = await _repository.UpdateAsync(request, ct);
        if (!updated) return NotFound();

        return Ok(await _repository.GetByIdAsync(request.Pkid, ct));
    }

    /// <summary>Delete a partner by pkid.</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(short id, CancellationToken ct)
    {
        var deleted = await _repository.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
