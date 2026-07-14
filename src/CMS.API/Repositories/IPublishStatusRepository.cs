using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IPublishStatusRepository
{
    Task<IEnumerable<PublishStatus>> GetAllAsync(CancellationToken ct = default);
    Task<IEnumerable<PublishStatus>> QueryAsync(PublishStatusQuery query, CancellationToken ct = default);
    Task<PublishStatus?> GetByIdAsync(byte pkid, CancellationToken ct = default);
    Task<bool> ExistsAsync(byte pkid, CancellationToken ct = default);

    /// <summary>Inserts the status (pkid supplied by the caller). Returns the new pkid.</summary>
    Task<byte> CreateAsync(PublishStatusRequest request, CancellationToken ct = default);

    /// <summary>Updates the status. Returns false if the pkid does not exist.</summary>
    Task<bool> UpdateAsync(PublishStatusRequest request, CancellationToken ct = default);

    /// <summary>Deletes the status. Returns false if the pkid does not exist.</summary>
    Task<bool> DeleteAsync(byte pkid, CancellationToken ct = default);
}
