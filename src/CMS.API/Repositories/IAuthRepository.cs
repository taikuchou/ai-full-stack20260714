using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAuthRepository
{
    Task<AppUserCredential?> GetCredentialAsync(string userId, CancellationToken ct = default);
    Task<IReadOnlyList<string>> GetRoleIdsAsync(string userId, CancellationToken ct = default);
    Task<string> GetSigningKeyAsync(CancellationToken ct = default);

    /// <summary>
    /// Updates only the UserName of one account. Touches no other column — self-service rename
    /// must not be able to reach IsActive, PasswordHash or role assignments.
    /// </summary>
    /// <returns>False when no such UserId exists.</returns>
    Task<bool> UpdateUserNameAsync(string userId, string userName, CancellationToken ct = default);

    /// <summary>
    /// Writes a new password hash and stamps PasswordUpdatedTime. Takes an already-hashed value —
    /// hashing and the current-password check belong to the caller.
    /// </summary>
    /// <param name="updatedTime">
    /// UTC. Passed in rather than left to SQL's GETUTCDATE() so the stamp is assertable in tests.
    /// </param>
    /// <returns>False when no such UserId exists.</returns>
    Task<bool> ChangePasswordAsync(
        string userId, string newPasswordHash, DateTime updatedTime, CancellationToken ct = default);
}
