namespace CMS.API.Models;

/// <summary>Slim option item for select / multiselect controls.</summary>
public class LookupItem
{
    /// <summary>The value to bind (e.g. AppUser.UserId).</summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>The display label (e.g. "UserName (UserId)").</summary>
    public string Label { get; set; } = string.Empty;
}
