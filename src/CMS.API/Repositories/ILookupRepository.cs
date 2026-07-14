using CMS.API.Models;

namespace CMS.API.Repositories;

public interface ILookupRepository
{
    /// <summary>AppUser options for the role-assignment multiselect. Label = "UserName (UserId)".</summary>
    Task<IEnumerable<LookupItem>> GetAppUsersAsync(CancellationToken ct = default);
}
