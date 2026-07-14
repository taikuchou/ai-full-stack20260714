using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>
/// Write DTO for Course create/update. <see cref="Pkid"/> is the UPDATE key (taken from the
/// body); it is ignored on INSERT because the database assigns the IDENTITY value.
/// </summary>
public class CourseRequest
{
    public int Pkid { get; set; }

    [Required, MaxLength(200)] public string Title { get; set; } = string.Empty;
    [MaxLength(300)] public string? OfficialTitle { get; set; }
    [Required, MaxLength(50)] public string CourseId { get; set; } = string.Empty;
    [Required, MaxLength(50)] public string ProdCourseId { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string FriendlyUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }

    public short Partner_pkid { get; set; }
    public short? CourseGroup_pkid { get; set; }
    public byte PublishStatus_pkid { get; set; }

    public DateOnly ScheduleOn { get; set; }
    public DateOnly ScheduleOff { get; set; }
    public short Hour { get; set; }
    public decimal ListPrice { get; set; }
    public decimal LearningCredit { get; set; }

    [MaxLength(500)] public string? Material { get; set; }
    [MaxLength(4000)] public string? Objective { get; set; }
    [MaxLength(500)] public string? Target { get; set; }
    [MaxLength(4000)] public string? Prerequisites { get; set; }
    public string? Outline { get; set; }          // nvarchar(max)
    public string? TowardCertOrExam { get; set; } // nvarchar(max)
    [MaxLength(4000)] public string? Note { get; set; }
    [MaxLength(4000)] public string? OtherInfo { get; set; }
    public bool CanRepeat { get; set; }

    /// <summary>Certification pkids to link (via CourseInCertification). Synced delete-then-reinsert.</summary>
    public List<int> CertificationPkids { get; set; } = [];

    /// <summary>JobCategory pkids to link (via CourseJobCategories). Synced delete-then-reinsert.</summary>
    public List<short> JobCategoryPkids { get; set; } = [];
}
