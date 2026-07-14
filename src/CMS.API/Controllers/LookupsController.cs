using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/lookups")]
public class LookupsController : ControllerBase
{
    private readonly ILookupRepository _repository;

    public LookupsController(ILookupRepository repository) => _repository = repository;

    /// <summary>AppUser options for the role-assignment multiselect.</summary>
    [HttpGet("appusers")]
    public async Task<ActionResult<IEnumerable<LookupItem>>> GetAppUsers(CancellationToken ct)
        => Ok(await _repository.GetAppUsersAsync(ct));

    /// <summary>AppRole options for the AppUser role-assignment multiselect.</summary>
    [HttpGet("approles")]
    public async Task<ActionResult<IEnumerable<LookupItem>>> GetAppRoles(CancellationToken ct)
        => Ok(await _repository.GetAppRolesAsync(ct));

    /// <summary>PublishStatus options for FK dropdowns (Course, Promotion2).</summary>
    [HttpGet("publish-statuses")]
    public async Task<ActionResult<IEnumerable<LookupItem>>> GetPublishStatuses(CancellationToken ct)
        => Ok(await _repository.GetPublishStatusesAsync(ct));

    /// <summary>Partner options for FK dropdowns (Course, Certification).</summary>
    [HttpGet("partners")]
    public async Task<ActionResult<IEnumerable<LookupItem>>> GetPartners(CancellationToken ct)
        => Ok(await _repository.GetPartnersAsync(ct));

    /// <summary>CourseGroup options for FK dropdowns (Course, PartnerCourseGroup).</summary>
    [HttpGet("course-groups")]
    public async Task<ActionResult<IEnumerable<LookupItem>>> GetCourseGroups(CancellationToken ct)
        => Ok(await _repository.GetCourseGroupsAsync(ct));

    /// <summary>Certification options for the Course n-n multiselect.</summary>
    [HttpGet("certifications")]
    public async Task<ActionResult<IEnumerable<LookupItem>>> GetCertifications(CancellationToken ct)
        => Ok(await _repository.GetCertificationsAsync(ct));

    /// <summary>JobCategory options for the Course n-n multiselect.</summary>
    [HttpGet("job-categories")]
    public async Task<ActionResult<IEnumerable<LookupItem>>> GetJobCategories(CancellationToken ct)
        => Ok(await _repository.GetJobCategoriesAsync(ct));
}
