namespace CMS.API.Models;

/// <summary>
/// Response model for the CourseGroup entity (課程群組).
/// The primary key <see cref="Pkid"/> is a <c>smallint IDENTITY</c> assigned by the database.
/// </summary>
public class CourseGroup
{
    /// <summary>Primary key (主代碼). smallint IDENTITY, database-assigned.</summary>
    public short Pkid { get; set; }

    /// <summary>Group description (群組說明).</summary>
    public string Description { get; set; } = string.Empty;
}
