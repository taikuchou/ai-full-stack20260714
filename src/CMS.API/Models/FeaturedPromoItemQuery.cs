namespace CMS.API.Models;

/// <summary>Search DTO for the FeaturedPromoItem filtered-query endpoint.</summary>
public class FeaturedPromoItemQuery
{
    /// <summary>The TrainingCenter tab in view. Null = all centers.</summary>
    public short? TrainingCenterPkid { get; set; }

    /// <summary>
    /// Any date inside the week to show. The controller snaps this to the Monday of that week
    /// (see <see cref="Week.MondayOf"/>) and the repository matches ScheduleOn over the seven days
    /// Monday–Sunday. Null = no date filter.
    /// </summary>
    public DateOnly? WeekStart { get; set; }

    /// <summary>LIKE across Topic, Description and Promotion2.PromoCode.</summary>
    public string? Keyword { get; set; }
}
