namespace CMS.API.Models;

/// <summary>
/// Response model for the AppRole entity (角色 / 使用者角色).
/// The primary key is the string column <see cref="RoleId"/>; <see cref="Pkid"/> is an
/// IDENTITY column surfaced for display only (主代碼).
/// </summary>
public class AppRole
{
    public int Pkid { get; set; }
    public string RoleId { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public int PermissionLevel { get; set; }
    public string? Description { get; set; }

    /// <summary>Number of users assigned to this role (via AppUserRole). Populated in list/view.</summary>
    public int UserCount { get; set; }

    /// <summary>UserIds assigned to this role (via AppUserRole). Populated on GET by id.</summary>
    public List<string> UserIds { get; set; } = [];
}
