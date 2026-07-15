using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAuthRepository
{
    Task<AppUserCredential?> GetCredentialAsync(string userId, CancellationToken ct = default);
    Task<IReadOnlyList<string>> GetRoleIdsAsync(string userId, CancellationToken ct = default);
    Task<string> GetSigningKeyAsync(CancellationToken ct = default);
}
