namespace CMS.API.Models;

/// <summary>
/// Response for PUT /api/auth/profile. Mirrors <see cref="LoginResponse"/>: the access token is
/// re-issued so its Name claim matches the new UserName instead of going stale until expiry.
/// </summary>
public class UpdateProfileResponse
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
}
