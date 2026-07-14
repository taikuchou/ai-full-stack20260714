using CMS.API.Models;

namespace CMS.API.Repositories;

public interface ICourseRepository
{
    Task<IEnumerable<Course>> GetAllAsync(CancellationToken ct = default);
    Task<IEnumerable<Course>> QueryAsync(CourseQuery query, CancellationToken ct = default);

    /// <summary>Single course by pkid, with CertificationPkids / JobCategoryPkids filled.</summary>
    Task<Course?> GetByIdAsync(int pkid, CancellationToken ct = default);

    /// <summary>Inserts the course and its n-n links in a transaction. Returns the DB-assigned pkid.</summary>
    Task<int> CreateAsync(CourseRequest request, CancellationToken ct = default);

    /// <summary>Updates the course and re-syncs n-n links. Returns false if the course does not exist.</summary>
    Task<bool> UpdateAsync(CourseRequest request, CancellationToken ct = default);

    /// <summary>Deletes the course and its n-n links. Returns false if the course does not exist.</summary>
    Task<bool> DeleteAsync(int pkid, CancellationToken ct = default);
}
