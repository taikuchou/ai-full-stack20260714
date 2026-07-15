using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>
/// Write DTO for FeaturedPromoItem create/update. <see cref="Pkid"/> is the UPDATE key (taken from
/// the body); it is ignored on INSERT because the database assigns the IDENTITY value.
/// </summary>
public class FeaturedPromoItemRequest
{
    public int Pkid { get; set; }

    public DateOnly ScheduleOn { get; set; }
    public short TrainingCenter_pkid { get; set; }

    /// <summary>Position within the day's column, 1–3.</summary>
    public byte Slot { get; set; }

    /// <summary>Promotion2 pkid, resolved from the typed PromoCode via the promo-codes lookup.</summary>
    public int Promotion_pkid { get; set; }

    [Required, MaxLength(100)] public string Topic { get; set; } = string.Empty;
    [Required, MaxLength(300)] public string Description { get; set; } = string.Empty;
}
