namespace CMS.API.Models;

/// <summary>Search DTO for filtering AppUser records.</summary>
public class AppUserQuery
{
    /// <summary>LIKE match against UserId and UserName.</summary>
    public string? Keyword { get; set; }

    /// <summary>Tri-state active filter: null = all, true = active, false = inactive.</summary>
    public bool? IsActive { get; set; }
}
