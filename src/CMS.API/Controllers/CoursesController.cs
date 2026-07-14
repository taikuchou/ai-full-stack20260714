using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/courses")]
public class CoursesController : ControllerBase
{
    private readonly ICourseRepository _repository;

    public CoursesController(ICourseRepository repository) => _repository = repository;

    /// <summary>All courses.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Course>>> GetAll(CancellationToken ct)
        => Ok(await _repository.GetAllAsync(ct));

    /// <summary>Filtered search.</summary>
    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<Course>>> Query([FromBody] CourseQuery query, CancellationToken ct)
        => Ok(await _repository.QueryAsync(query, ct));

    /// <summary>Single course by pkid.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Course>> GetById(int id, CancellationToken ct)
    {
        var course = await _repository.GetByIdAsync(id, ct);
        return course is null ? NotFound() : Ok(course);
    }

    /// <summary>Create a course. pkid is assigned by the database.</summary>
    [HttpPost]
    public async Task<ActionResult<Course>> Create([FromBody] CourseRequest request, CancellationToken ct)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(error);

        var newId = await _repository.CreateAsync(request, ct);
        var created = await _repository.GetByIdAsync(newId, ct);
        return CreatedAtAction(nameof(GetById), new { id = newId }, created);
    }

    /// <summary>Update a course. pkid (key) is taken from the body.</summary>
    [HttpPut]
    public async Task<ActionResult<Course>> Update([FromBody] CourseRequest request, CancellationToken ct)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(error);

        var updated = await _repository.UpdateAsync(request, ct);
        if (!updated) return NotFound();

        return Ok(await _repository.GetByIdAsync(request.Pkid, ct));
    }

    /// <summary>Delete a course by pkid.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await _repository.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    // Required-field validation mirroring the NOT NULL columns without a DB default.
    private static string? Validate(CourseRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return "Title is required.";
        if (string.IsNullOrWhiteSpace(request.CourseId))
            return "CourseId is required.";
        if (string.IsNullOrWhiteSpace(request.ProdCourseId))
            return "ProdCourseId is required.";
        if (string.IsNullOrWhiteSpace(request.FriendlyUrl))
            return "FriendlyUrl is required.";
        return null;
    }
}
