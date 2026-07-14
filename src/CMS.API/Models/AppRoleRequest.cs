namespace CMS.API.Models;

/// <summary>Write DTO for creating / updating an AppRole. <see cref="RoleId"/> is the key.</summary>
public class AppRoleRequest
{
    public string RoleId { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public int PermissionLevel { get; set; } = 100;
    public string? Description { get; set; }

    /// <summary>Assigned users (n-n via AppUserRole). Synced delete-then-reinsert on save.</summary>
    public List<string> UserIds { get; set; } = [];
}
