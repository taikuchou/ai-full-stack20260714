namespace CMS.API.Models;

/// <summary>
/// Result of resolving a typed Promotion2.PromoCode to its pkid. Topic and Description ride along
/// so the FeaturedPromoItem form can seed its own (independently editable) copies of them.
/// </summary>
public class PromoCodeLookup
{
    /// <summary>Promotion2.pkid — what the form stores in FeaturedPromoItem.Promotion_pkid.</summary>
    public int Pkid { get; set; }

    public string PromoCode { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
