namespace CMS.API.Security;

/// <summary>
/// New-password complexity rule: at least 8 characters, and at least 3 of the 4 character classes
/// (uppercase / lowercase / digit / symbol).
/// </summary>
public static class PasswordPolicy
{
    public const int MinimumLength = 8;
    public const int RequiredClasses = 3;

    /// <summary>
    /// The single bilingual message shown for any complexity failure. Deliberately one message for
    /// both the length and the class rule — telling a caller which half failed narrows a guess.
    /// </summary>
    public const string ComplexityMessage =
        "密碼長度至少需 8 碼，且內容須至少包含四種字元的其中三種：大寫英文／小寫英文／數字／符號 "
        + "(Password must be at least 8 characters and contain at least 3 of the 4 classes: "
        + "uppercase / lowercase / digit / symbol.)";

    public static bool IsCompliant(string? password)
    {
        if (password is null || password.Length < MinimumLength)
            return false;

        // "Symbol" is anything that is not a letter or digit — punctuation, math symbols, space.
        var classes = 0;
        if (password.Any(char.IsUpper)) classes++;
        if (password.Any(char.IsLower)) classes++;
        if (password.Any(char.IsDigit)) classes++;
        if (password.Any(c => !char.IsLetterOrDigit(c))) classes++;

        return classes >= RequiredClasses;
    }
}
