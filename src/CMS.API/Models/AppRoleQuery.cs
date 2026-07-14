namespace CMS.API.Models;

/// <summary>Search DTO for filtering AppRole records.</summary>
public class AppRoleQuery
{
    /// <summary>LIKE match against RoleId, RoleName and Description.</summary>
    public string? Keyword { get; set; }

    /// <summary>Lower bound (inclusive) for PermissionLevel.</summary>
    public int? PermissionLevelFrom { get; set; }

    /// <summary>Upper bound (inclusive) for PermissionLevel.</summary>
    public int? PermissionLevelTo { get; set; }
}
