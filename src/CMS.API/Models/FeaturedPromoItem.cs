namespace CMS.API.Models;

/// <summary>
/// Response model for the FeaturedPromoItem entity (上稿作業). The primary key <see cref="Pkid"/>
/// is an <c>int IDENTITY</c> assigned by the database.
/// <para>
/// A row is one promo pinned to a (ScheduleOn, TrainingCenter, Slot) cell of the weekly schedule
/// grid; the DB enforces that triple as unique. FK label fields (<see cref="TrainingCenterName"/>,
/// <see cref="PromoCode"/>) are read-only, populated via LEFT JOINs.
/// </para>
/// </summary>
public class FeaturedPromoItem
{
    /// <summary>Lowest slot number in a day's grid column.</summary>
    public const byte MinSlot = 1;

    /// <summary>Highest slot number in a day's grid column. The UI renders slots 1–3 per day.</summary>
    public const byte MaxSlot = 3;

    public int Pkid { get; set; }                       // int IDENTITY, DB-assigned
    public DateOnly ScheduleOn { get; set; }
    public short TrainingCenter_pkid { get; set; }
    public byte Slot { get; set; }
    public int Promotion_pkid { get; set; }
    public string Topic { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    // Flat FK label fields (read-only, from LEFT JOINs) — used by the grid columns.

    /// <summary>TrainingCenter.Name — the label of the tab this row belongs to.</summary>
    public string? TrainingCenterName { get; set; }

    /// <summary>Promotion2.PromoCode for <see cref="Promotion_pkid"/> — shown in the grid.</summary>
    public string? PromoCode { get; set; }
}
