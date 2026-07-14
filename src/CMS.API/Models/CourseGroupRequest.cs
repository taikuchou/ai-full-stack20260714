using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>
/// Write DTO for creating / updating a CourseGroup. <see cref="Pkid"/> is carried for the UPDATE
/// key; it is ignored on INSERT (the DB assigns the IDENTITY value).
/// </summary>
public class CourseGroupRequest
{
    public short Pkid { get; set; }

    [Required]
    [MaxLength(100)]
    public string Description { get; set; } = string.Empty;
}
