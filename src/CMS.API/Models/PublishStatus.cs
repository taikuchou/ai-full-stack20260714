namespace CMS.API.Models;

/// <summary>
/// Response model for the PublishStatus entity (發布狀態).
/// The primary key <see cref="Pkid"/> is a <c>tinyint</c> that is <b>assigned by the user</b>
/// (not an IDENTITY column), so it is supplied on create and is immutable thereafter.
/// </summary>
public class PublishStatus
{
    /// <summary>Status code (狀態代碼). User-assigned tinyint primary key.</summary>
    public byte Pkid { get; set; }

    /// <summary>Status description (狀態說明).</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>Draft state flag (草稿).</summary>
    public bool IsDraft { get; set; }

    /// <summary>Published state flag (已發布).</summary>
    public bool IsPublished { get; set; }

    /// <summary>Discontinued state flag (已停用).</summary>
    public bool IsDiscontinued { get; set; }
}
