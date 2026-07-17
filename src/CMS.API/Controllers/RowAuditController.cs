using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

/// <summary>
/// Reads a single record's audit trail. Read-only: RowAudit rows are written by the repositories
/// themselves and are never created or edited over HTTP.
/// </summary>
[ApiController]
[Route("api/rowaudit")]
public class RowAuditController : ControllerBase
{
    private readonly IRowAuditRepository _repository;

    public RowAuditController(IRowAuditRepository repository) => _repository = repository;

    /// <summary>One record's history, newest first — e.g. /api/rowaudit?tableName=Course&amp;pkid=123.</summary>
    /// <remarks>
    /// pkid is a string because RowAudit.PrimaryKeyValues is nvarchar: the trail is keyed the same
    /// way for every table regardless of the entity's own pkid type.
    /// </remarks>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RowAuditHistoryItem>>> GetForRecord(
        [FromQuery] string? tableName, [FromQuery] string? pkid, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tableName))
            return BadRequest("tableName is required.");
        if (string.IsNullOrWhiteSpace(pkid))
            return BadRequest("pkid is required.");

        return Ok(await _repository.GetForRecordAsync(tableName.Trim(), pkid.Trim(), ct));
    }
}
