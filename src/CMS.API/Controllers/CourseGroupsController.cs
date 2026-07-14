using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/course-groups")]
public class CourseGroupsController : ControllerBase
{
    private readonly ICourseGroupRepository _repository;

    public CourseGroupsController(ICourseGroupRepository repository) => _repository = repository;

    /// <summary>All course groups.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CourseGroup>>> GetAll(CancellationToken ct)
        => Ok(await _repository.GetAllAsync(ct));

    /// <summary>Filtered search.</summary>
    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<CourseGroup>>> Query([FromBody] CourseGroupQuery query, CancellationToken ct)
        => Ok(await _repository.QueryAsync(query, ct));

    /// <summary>Single course group by pkid.</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<CourseGroup>> GetById(short id, CancellationToken ct)
    {
        var courseGroup = await _repository.GetByIdAsync(id, ct);
        return courseGroup is null ? NotFound() : Ok(courseGroup);
    }

    /// <summary>Create a course group. pkid is assigned by the database.</summary>
    [HttpPost]
    public async Task<ActionResult<CourseGroup>> Create([FromBody] CourseGroupRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest("Description is required.");

        var newId = await _repository.CreateAsync(request, ct);
        var created = await _repository.GetByIdAsync(newId, ct);
        return CreatedAtAction(nameof(GetById), new { id = newId }, created);
    }

    /// <summary>Update a course group. pkid (key) is taken from the body.</summary>
    [HttpPut]
    public async Task<ActionResult<CourseGroup>> Update([FromBody] CourseGroupRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest("Description is required.");

        var updated = await _repository.UpdateAsync(request, ct);
        if (!updated) return NotFound();

        return Ok(await _repository.GetByIdAsync(request.Pkid, ct));
    }

    /// <summary>Delete a course group by pkid.</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(short id, CancellationToken ct)
    {
        var deleted = await _repository.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
