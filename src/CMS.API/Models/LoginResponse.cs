namespace CMS.API.Models;

// UserId / UserName / AccessToken only — PasswordHash must never reach the client.
public class LoginResponse
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
}
