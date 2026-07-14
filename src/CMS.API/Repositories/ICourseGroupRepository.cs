using CMS.API.Models;

namespace CMS.API.Repositories;

public interface ICourseGroupRepository
{
    Task<IEnumerable<CourseGroup>> GetAllAsync(CancellationToken ct = default);
    Task<IEnumerable<CourseGroup>> QueryAsync(CourseGroupQuery query, CancellationToken ct = default);
    Task<CourseGroup?> GetByIdAsync(short pkid, CancellationToken ct = default);

    /// <summary>Inserts the course group (pkid is IDENTITY). Returns the new pkid.</summary>
    Task<short> CreateAsync(CourseGroupRequest request, CancellationToken ct = default);

    /// <summary>Updates the course group. Returns false if the pkid does not exist.</summary>
    Task<bool> UpdateAsync(CourseGroupRequest request, CancellationToken ct = default);

    /// <summary>Deletes the course group. Returns false if the pkid does not exist.</summary>
    Task<bool> DeleteAsync(short pkid, CancellationToken ct = default);
}
