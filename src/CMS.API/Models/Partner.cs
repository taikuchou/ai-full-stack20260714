namespace CMS.API.Models;

/// <summary>
/// Response model for the Partner entity (合作廠商).
/// The primary key <see cref="Pkid"/> is a <c>smallint IDENTITY</c> assigned by the database.
/// </summary>
public class Partner
{
    /// <summary>Primary key (主代碼). smallint IDENTITY, database-assigned.</summary>
    public short Pkid { get; set; }

    /// <summary>Partner name (廠商名稱).</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Application key / code (應用代碼).</summary>
    public string AppKey { get; set; } = string.Empty;

    /// <summary>Display name shown on the partner menu (選單顯示名稱).</summary>
    public string NameOnPartnerMenu { get; set; } = string.Empty;

    /// <summary>Display name shown on the course detail page (課程頁顯示名稱).</summary>
    public string NameOnCourseDetailPage { get; set; } = string.Empty;

    /// <summary>Sort order (顯示順序).</summary>
    public int DisplayOrder { get; set; }

    /// <summary>Optional logo image filename (圖檔名稱).</summary>
    public string? ImageFilename { get; set; }
}
