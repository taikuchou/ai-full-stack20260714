namespace CMS.API.Security;

/// <summary>
/// RoleIds from the AppRole table, as they appear in a token's role claims.
/// <para>
/// These are data, not code — a RoleId renamed in the database silently stops matching here, and
/// [Authorize(Roles = ...)] then denies everyone rather than failing loudly. Named constants at
/// least keep the string in one place.
/// </para>
/// </summary>
public static class AppRoles
{
    public const string Admin = "Admin";
}
