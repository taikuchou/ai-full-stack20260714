using System.Security.Cryptography;
using System.Text;

namespace CMS.API.Security;

public static class PasswordHasher
{
    // SHA-256, stored/compared as uppercase hex.
    public static string Hash(string plain)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plain)));
}
