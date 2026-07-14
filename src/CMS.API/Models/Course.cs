namespace CMS.API.Models;

/// <summary>
/// Response model for the Course entity (課程). The primary key <see cref="Pkid"/> is an
/// <c>int IDENTITY</c> assigned by the database.
/// <para>
/// FK label fields (<see cref="PartnerName"/>, <see cref="CourseGroupDescription"/>,
/// <see cref="PublishStatusDescription"/>) are read-only, populated via LEFT JOINs for the
/// list columns. The n-n id lists (<see cref="CertificationPkids"/>,
/// <see cref="JobCategoryPkids"/>) are populated on GET by id; the counts are populated in
/// list/view via correlated subqueries.
/// </para>
/// </summary>
public class Course
{
    public int Pkid { get; set; }                       // int IDENTITY, DB-assigned
    public string Title { get; set; } = string.Empty;
    public string? OfficialTitle { get; set; }
    public string CourseId { get; set; } = string.Empty;
    public string ProdCourseId { get; set; } = string.Empty;
    public string FriendlyUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }

    public short Partner_pkid { get; set; }
    public short? CourseGroup_pkid { get; set; }
    public byte PublishStatus_pkid { get; set; }

    // Flat FK label fields (read-only, from LEFT JOINs) — used by the list columns.
    public string? PartnerName { get; set; }
    public string? CourseGroupDescription { get; set; }
    public string? PublishStatusDescription { get; set; }

    public DateOnly ScheduleOn { get; set; }
    public DateOnly ScheduleOff { get; set; }
    public short Hour { get; set; }
    public decimal ListPrice { get; set; }
    public decimal LearningCredit { get; set; }

    public string? Material { get; set; }
    public string? Objective { get; set; }
    public string? Target { get; set; }
    public string? Prerequisites { get; set; }
    public string? Outline { get; set; }
    public string? TowardCertOrExam { get; set; }
    public string? Note { get; set; }
    public string? OtherInfo { get; set; }
    public bool CanRepeat { get; set; }

    /// <summary>Number of linked Certifications (via CourseInCertification). Populated in list/view.</summary>
    public int CertificationCount { get; set; }

    /// <summary>Number of linked JobCategories (via CourseJobCategories). Populated in list/view.</summary>
    public int JobCategoryCount { get; set; }

    /// <summary>Certification pkids linked to this course. Populated on GET by id.</summary>
    public List<int> CertificationPkids { get; set; } = [];

    /// <summary>JobCategory pkids linked to this course. Populated on GET by id.</summary>
    public List<short> JobCategoryPkids { get; set; } = [];
}
