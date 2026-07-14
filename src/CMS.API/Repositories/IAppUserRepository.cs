using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAppUserRepository
{
    Task<IEnumerable<AppUser>> GetAllAsync(CancellationToken ct = default);
    Task<IEnumerable<AppUser>> QueryAsync(AppUserQuery query, CancellationToken ct = default);
    Task<AppUser?> GetByIdAsync(string userId, CancellationToken ct = default);
    Task<bool> ExistsAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Inserts the user (hashing the configured default password) and its AppUserRole
    /// assignments. Returns the new UserId.
    /// </summary>
    Task<string> CreateAsync(AppUserRequest request, CancellationToken ct = default);

    /// <summary>
    /// Updates the user (UserName / IsActive) and re-syncs role assignments. The password hash is
    /// never touched here. Returns false if the user does not exist.
    /// </summary>
    Task<bool> UpdateAsync(AppUserRequest request, CancellationToken ct = default);

    /// <summary>Deletes the user and its assignments. Returns false if the user does not exist.</summary>
    Task<bool> DeleteAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Resets the user's password to the configured default (re-hashed) and stamps
    /// PasswordUpdatedTime. Returns false if the user does not exist.
    /// </summary>
    Task<bool> ResetPasswordAsync(string userId, CancellationToken ct = default);
}
