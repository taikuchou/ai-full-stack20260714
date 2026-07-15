namespace CMS.API.Models;

// Internal to the login flow only — carries PasswordHash, which must never be serialized to a client.
public class AppUserCredential
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
}
