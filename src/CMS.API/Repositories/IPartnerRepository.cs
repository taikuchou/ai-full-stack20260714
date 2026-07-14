using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IPartnerRepository
{
    Task<IEnumerable<Partner>> GetAllAsync(CancellationToken ct = default);
    Task<IEnumerable<Partner>> QueryAsync(PartnerQuery query, CancellationToken ct = default);
    Task<Partner?> GetByIdAsync(short pkid, CancellationToken ct = default);

    /// <summary>Inserts the partner (pkid is IDENTITY). Returns the new pkid.</summary>
    Task<short> CreateAsync(PartnerRequest request, CancellationToken ct = default);

    /// <summary>Updates the partner. Returns false if the pkid does not exist.</summary>
    Task<bool> UpdateAsync(PartnerRequest request, CancellationToken ct = default);

    /// <summary>Deletes the partner. Returns false if the pkid does not exist.</summary>
    Task<bool> DeleteAsync(short pkid, CancellationToken ct = default);
}
