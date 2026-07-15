namespace CMS.API.Models;

/// <summary>
/// Write DTO for PUT /api/auth/profile — a signed-in user renaming themselves.
/// <para>
/// There is deliberately no UserId and no roles field. The account to rename is taken from the
/// caller's JWT, so this DTO cannot name another user or grant a role. A <c>userId</c> sent in the
/// JSON body binds to nothing and is ignored.
/// </para>
/// </summary>
public class UpdateProfileRequest
{
    public string UserName { get; set; } = string.Empty;
}
