namespace CMS.API.Models;

/// <summary>
/// Week arithmetic for the FeaturedPromoItem schedule grid, which always runs Monday–Sunday.
/// </summary>
public static class Week
{
    /// <summary>Days in the grid: Monday through Sunday.</summary>
    public const int Days = 7;

    /// <summary>The Monday of the week containing <paramref name="date"/>.</summary>
    public static DateOnly MondayOf(DateOnly date)
    {
        // DayOfWeek numbers Sunday as 0; shift so Monday = 0 … Sunday = 6.
        var offset = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-offset);
    }

    /// <summary>The Sunday closing the week containing <paramref name="date"/>.</summary>
    public static DateOnly SundayOf(DateOnly date) => MondayOf(date).AddDays(Days - 1);
}
