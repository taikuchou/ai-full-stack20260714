namespace CMS.API.Models;

/// <summary>Search DTO for filtering CourseGroup records.</summary>
public class CourseGroupQuery
{
    /// <summary>LIKE match against Description.</summary>
    public string? Keyword { get; set; }
}
