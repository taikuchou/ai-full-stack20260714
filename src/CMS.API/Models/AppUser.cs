namespace CMS.API.Models;

/// <summary>
/// Response model for the AppUser entity (使用者 / 系統使用者帳號).
/// The primary key is the string column <see cref="UserId"/>; <see cref="Pkid"/> is an
/// IDENTITY column surfaced for display only (主代碼).
/// <para>
/// The database column <c>PasswordHash</c> is intentionally absent: it is managed entirely
/// server-side and never sent to the client.
/// </para>
/// </summary>
public class AppUser
{
    public int Pkid { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; }

    /// <summary>UTC time the password was last written (create / reset). Null if never set.</summary>
    public DateTime? PasswordUpdatedTime { get; set; }

    /// <summary>Number of roles assigned to this user (via AppUserRole). Populated in list/view.</summary>
    public int RoleCount { get; set; }

    /// <summary>RoleIds assigned to this user (via AppUserRole). Populated on GET by id.</summary>
    public List<string> RoleIds { get; set; } = [];
}
