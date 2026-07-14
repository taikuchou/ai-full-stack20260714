namespace CMS.API.Models;

/// <summary>
/// Write DTO for creating / updating an AppUser. <see cref="UserId"/> is the key.
/// <para>
/// There is no password field: on create the hash is derived server-side from the configured
/// default password, and updates never touch it (see the reset-password endpoint).
/// </para>
/// </summary>
public class AppUserRequest
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    /// <summary>Assigned roles (n-n via AppUserRole). Synced delete-then-reinsert on save.</summary>
    public List<string> RoleIds { get; set; } = [];
}
