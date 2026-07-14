using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>Write DTO for creating / updating a PublishStatus. <see cref="Pkid"/> is the user-assigned key.</summary>
public class PublishStatusRequest
{
    /// <summary>User-assigned tinyint primary key (狀態代碼).</summary>
    public byte Pkid { get; set; }

    [Required]
    [MaxLength(50)]
    public string Description { get; set; } = string.Empty;

    public bool IsDraft { get; set; }
    public bool IsPublished { get; set; }
    public bool IsDiscontinued { get; set; }
}
