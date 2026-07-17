namespace CMS.API.Models;

/// <summary>
/// Write DTO for POST /api/auth/change-password. Plaintext in, never a hash: hashing is the
/// server's job, and a client-supplied hash would let a caller replay a stolen one verbatim.
/// <para>
/// There is deliberately no UserId — the account is taken from the caller's JWT, so this cannot
/// change anyone else's password.
/// </para>
/// </summary>
public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
    public string ConfirmNewPassword { get; set; } = string.Empty;
}
