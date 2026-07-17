using CMS.API.Models;

namespace CMS.API.Repositories;

/// <summary>Outcome of a slot move.</summary>
public enum MoveResult
{
    /// <summary>The item moved (swapping with the target slot's occupant, if there was one).</summary>
    Moved,

    /// <summary>No item with that pkid.</summary>
    NotFound,

    /// <summary>The move would leave the 1–3 slot range.</summary>
    OutOfRange
}

public interface IFeaturedPromoItemRepository
{
    Task<IEnumerable<FeaturedPromoItem>> GetAllAsync(CancellationToken ct = default);

    /// <summary>
    /// Rows matching the TrainingCenter tab and the Monday–Sunday week starting at
    /// <see cref="FeaturedPromoItemQuery.WeekStart"/>, ordered by date then slot.
    /// </summary>
    Task<IEnumerable<FeaturedPromoItem>> QueryAsync(FeaturedPromoItemQuery query, CancellationToken ct = default);

    Task<FeaturedPromoItem?> GetByIdAsync(int pkid, CancellationToken ct = default);

    /// <summary>Inserts the item. Returns the DB-assigned pkid.</summary>
    Task<int> CreateAsync(FeaturedPromoItemRequest request, CancellationToken ct = default);

    /// <summary>Updates the item. Returns false if it does not exist.</summary>
    Task<bool> UpdateAsync(FeaturedPromoItemRequest request, CancellationToken ct = default);

    /// <summary>Deletes the item. Returns false if it does not exist.</summary>
    Task<bool> DeleteAsync(int pkid, CancellationToken ct = default);

    /// <summary>
    /// Shifts the item one slot within its day/centre column: <paramref name="delta"/> +1 moves it
    /// down, -1 moves it up. If the target slot is taken, the two rows swap.
    /// </summary>
    Task<MoveResult> MoveAsync(int pkid, int delta, CancellationToken ct = default);
}
