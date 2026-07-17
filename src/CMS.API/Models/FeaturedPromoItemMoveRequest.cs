namespace CMS.API.Models;

/// <summary>
/// Body for the slot-move endpoint, backing the grid's <c>+</c> / <c>-</c> links.
/// </summary>
public class FeaturedPromoItemMoveRequest
{
    /// <summary>The item to move.</summary>
    public int Pkid { get; set; }

    /// <summary>
    /// <c>+1</c> moves the item down one slot (1 → 2), <c>-1</c> moves it up (2 → 1). Any other
    /// value is rejected.
    /// </summary>
    public int Delta { get; set; }
}
