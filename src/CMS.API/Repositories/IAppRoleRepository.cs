using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAppRoleRepository
{
    Task<IEnumerable<AppRole>> GetAllAsync(CancellationToken ct = default);
    Task<IEnumerable<AppRole>> QueryAsync(AppRoleQuery query, CancellationToken ct = default);
    Task<AppRole?> GetByIdAsync(string roleId, CancellationToken ct = default);
    Task<bool> ExistsAsync(string roleId, CancellationToken ct = default);

    /// <summary>Inserts the role and its AppUserRole assignments. Returns the new RoleId.</summary>
    Task<string> CreateAsync(AppRoleRequest request, CancellationToken ct = default);

    /// <summary>Updates the role and re-syncs assignments. Returns false if the role does not exist.</summary>
    Task<bool> UpdateAsync(AppRoleRequest request, CancellationToken ct = default);

    /// <summary>Deletes the role and its assignments. Returns false if the role does not exist.</summary>
    Task<bool> DeleteAsync(string roleId, CancellationToken ct = default);
}
