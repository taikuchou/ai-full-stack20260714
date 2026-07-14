namespace CMS.API.Models;

/// <summary>Search DTO for filtering Partner records.</summary>
public class PartnerQuery
{
    /// <summary>LIKE match against Name, AppKey, NameOnPartnerMenu and NameOnCourseDetailPage.</summary>
    public string? Keyword { get; set; }

    /// <summary>Lower bound (inclusive) for DisplayOrder.</summary>
    public int? DisplayOrderFrom { get; set; }

    /// <summary>Upper bound (inclusive) for DisplayOrder.</summary>
    public int? DisplayOrderTo { get; set; }
}
