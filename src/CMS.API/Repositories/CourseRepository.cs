using System.Data;
using CMS.API.Auditing;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class CourseRepository : ICourseRepository
{
    private const string TableName = "Course";

    private readonly IDbConnectionFactory _factory;
    private readonly IRowAuditWriter _audit;

    public CourseRepository(IDbConnectionFactory factory, IRowAuditWriter audit)
    {
        _factory = factory;
        _audit = audit;
    }

    // Shared SELECT for list/view. FK labels via LEFT JOIN; n-n counts via correlated subqueries.
    // CourseGroup is a nullable FK, so LEFT JOIN keeps courses with no group.
    private const string SelectList = @"
SELECT c.pkid                AS Pkid,
       c.Title               AS Title,
       c.OfficialTitle       AS OfficialTitle,
       c.CourseId            AS CourseId,
       c.ProdCourseId        AS ProdCourseId,
       c.FriendlyUrl         AS FriendlyUrl,
       c.DisplayOrder        AS DisplayOrder,
       c.Partner_pkid        AS Partner_pkid,
       c.CourseGroup_pkid    AS CourseGroup_pkid,
       c.PublishStatus_pkid  AS PublishStatus_pkid,
       p.Name                AS PartnerName,
       g.Description         AS CourseGroupDescription,
       s.Description         AS PublishStatusDescription,
       c.ScheduleOn          AS ScheduleOn,
       c.ScheduleOff         AS ScheduleOff,
       c.Hour                AS Hour,
       c.ListPrice           AS ListPrice,
       c.LearningCredit      AS LearningCredit,
       c.Material            AS Material,
       c.Objective           AS Objective,
       c.Target              AS Target,
       c.Prerequisites       AS Prerequisites,
       c.Outline             AS Outline,
       c.TowardCertOrExam    AS TowardCertOrExam,
       c.Note                AS Note,
       c.OtherInfo           AS OtherInfo,
       c.CanRepeat           AS CanRepeat,
       (SELECT COUNT(*) FROM CourseInCertification ic WHERE ic.Course_pkid = c.pkid) AS CertificationCount,
       (SELECT COUNT(*) FROM CourseJobCategories  jc WHERE jc.Course_pkid = c.pkid) AS JobCategoryCount
FROM Course c
LEFT JOIN Partner       p ON p.pkid = c.Partner_pkid
LEFT JOIN CourseGroup   g ON g.pkid = c.CourseGroup_pkid
LEFT JOIN PublishStatus s ON s.pkid = c.PublishStatus_pkid";

    public async Task<IEnumerable<Course>> GetAllAsync(CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<Course>(
            new CommandDefinition($"{SelectList} ORDER BY c.DisplayOrder ASC, c.pkid ASC", cancellationToken: ct));
    }

    public async Task<IEnumerable<Course>> QueryAsync(CourseQuery query, CancellationToken ct = default)
    {
        var sql = $@"{SelectList}
WHERE (@Keyword IS NULL
        OR c.Title LIKE @KeywordLike
        OR c.OfficialTitle LIKE @KeywordLike
        OR c.CourseId LIKE @KeywordLike
        OR c.ProdCourseId LIKE @KeywordLike
        OR c.FriendlyUrl LIKE @KeywordLike)
  AND (@PartnerPkid       IS NULL OR c.Partner_pkid = @PartnerPkid)
  AND (@CourseGroupPkid   IS NULL OR c.CourseGroup_pkid = @CourseGroupPkid)
  AND (@PublishStatusPkid IS NULL OR c.PublishStatus_pkid = @PublishStatusPkid)
  AND (@CanRepeat         IS NULL OR c.CanRepeat = @CanRepeat)
  AND (@ScheduleOnFrom    IS NULL OR c.ScheduleOn >= @ScheduleOnFrom)
  AND (@ScheduleOnTo      IS NULL OR c.ScheduleOn <= @ScheduleOnTo)
  AND (@ScheduleOffFrom   IS NULL OR c.ScheduleOff >= @ScheduleOffFrom)
  AND (@ScheduleOffTo     IS NULL OR c.ScheduleOff <= @ScheduleOffTo)
ORDER BY c.DisplayOrder ASC, c.pkid ASC";

        var keyword = string.IsNullOrWhiteSpace(query.Keyword) ? null : query.Keyword.Trim();
        var parameters = new
        {
            Keyword = keyword,
            KeywordLike = keyword is null ? null : $"%{keyword}%",
            query.PartnerPkid,
            query.CourseGroupPkid,
            query.PublishStatusPkid,
            query.CanRepeat,
            query.ScheduleOnFrom,
            query.ScheduleOnTo,
            query.ScheduleOffFrom,
            query.ScheduleOffTo
        };

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<Course>(new CommandDefinition(sql, parameters, cancellationToken: ct));
    }

    public async Task<Course?> GetByIdAsync(int pkid, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await LoadAsync(conn, null, pkid, ct);
    }

    /// <summary>
    /// Reads a course and its n-n id lists. Takes the caller's transaction so audit "before"
    /// snapshots see the same uncommitted state as the change itself.
    /// </summary>
    private static async Task<Course?> LoadAsync(
        IDbConnection conn, IDbTransaction? tx, int pkid, CancellationToken ct)
    {
        var sql = $@"{SelectList} WHERE c.pkid = @Pkid;
SELECT Certification_pkid FROM CourseInCertification WHERE Course_pkid = @Pkid ORDER BY Certification_pkid;
SELECT JobCategory_pkid   FROM CourseJobCategories  WHERE Course_pkid = @Pkid ORDER BY JobCategory_pkid;";

        using var multi = await conn.QueryMultipleAsync(
            new CommandDefinition(sql, new { Pkid = pkid }, tx, cancellationToken: ct));

        var course = await multi.ReadFirstOrDefaultAsync<Course>();
        if (course is null) return null;

        course.CertificationPkids = (await multi.ReadAsync<int>()).ToList();
        course.JobCategoryPkids = (await multi.ReadAsync<short>()).ToList();
        return course;
    }

    /// <summary>Loads a row that must exist because the caller just wrote it inside this transaction.</summary>
    private static async Task<Course> RequireAsync(
        IDbConnection conn, IDbTransaction tx, int pkid, CancellationToken ct)
        => await LoadAsync(conn, tx, pkid, ct)
           ?? throw new InvalidOperationException($"{TableName} {pkid} is missing immediately after being written.");

    public async Task<int> CreateAsync(CourseRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // pkid is IDENTITY — omit from the column list; return the DB-assigned value.
        var newId = await conn.ExecuteScalarAsync<int>(new CommandDefinition(@"
INSERT INTO Course
  (Title, OfficialTitle, CourseId, ProdCourseId, FriendlyUrl, DisplayOrder,
   Partner_pkid, CourseGroup_pkid, PublishStatus_pkid, ScheduleOn, ScheduleOff,
   Hour, ListPrice, LearningCredit, Material, Objective, Target, Prerequisites,
   Outline, TowardCertOrExam, Note, OtherInfo, CanRepeat)
VALUES
  (@Title, @OfficialTitle, @CourseId, @ProdCourseId, @FriendlyUrl, @DisplayOrder,
   @Partner_pkid, @CourseGroup_pkid, @PublishStatus_pkid, @ScheduleOn, @ScheduleOff,
   @Hour, @ListPrice, @LearningCredit, @Material, @Objective, @Target, @Prerequisites,
   @Outline, @TowardCertOrExam, @Note, @OtherInfo, @CanRepeat);
SELECT CAST(SCOPE_IDENTITY() AS int);",
            ToInsertParams(request), tx, cancellationToken: ct));

        await SyncCertificationsAsync(conn, tx, newId, request.CertificationPkids, ct);
        await SyncJobCategoriesAsync(conn, tx, newId, request.JobCategoryPkids, ct);

        await _audit.LogInsertAsync(conn, tx, TableName, await RequireAsync(conn, tx, newId, ct), ct);

        tx.Commit();
        return newId;
    }

    public async Task<bool> UpdateAsync(CourseRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // Read the "before" inside the transaction so the audited change list is accurate.
        var before = await LoadAsync(conn, tx, request.Pkid, ct);
        if (before is null)
        {
            tx.Rollback();
            return false;
        }

        var affected = await conn.ExecuteAsync(new CommandDefinition(@"
UPDATE Course
SET Title = @Title,
    OfficialTitle = @OfficialTitle,
    CourseId = @CourseId,
    ProdCourseId = @ProdCourseId,
    FriendlyUrl = @FriendlyUrl,
    DisplayOrder = @DisplayOrder,
    Partner_pkid = @Partner_pkid,
    CourseGroup_pkid = @CourseGroup_pkid,
    PublishStatus_pkid = @PublishStatus_pkid,
    ScheduleOn = @ScheduleOn,
    ScheduleOff = @ScheduleOff,
    Hour = @Hour,
    ListPrice = @ListPrice,
    LearningCredit = @LearningCredit,
    Material = @Material,
    Objective = @Objective,
    Target = @Target,
    Prerequisites = @Prerequisites,
    Outline = @Outline,
    TowardCertOrExam = @TowardCertOrExam,
    Note = @Note,
    OtherInfo = @OtherInfo,
    CanRepeat = @CanRepeat
WHERE pkid = @Pkid;",
            ToUpdateParams(request), tx, cancellationToken: ct));

        if (affected == 0)
        {
            tx.Rollback();
            return false;
        }

        await SyncCertificationsAsync(conn, tx, request.Pkid, request.CertificationPkids, ct);
        await SyncJobCategoriesAsync(conn, tx, request.Pkid, request.JobCategoryPkids, ct);

        await _audit.LogUpdateAsync(
            conn, tx, TableName, before, await RequireAsync(conn, tx, request.Pkid, ct), ct);

        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(int pkid, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // Read the row before deleting it — afterwards its first string column is gone.
        var row = await LoadAsync(conn, tx, pkid, ct);
        if (row is null)
        {
            tx.Rollback();
            return false;
        }

        // Remove n-n rows first (also covered by ON DELETE CASCADE, but explicit for clarity).
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM CourseInCertification WHERE Course_pkid = @Pkid",
            new { Pkid = pkid }, tx, cancellationToken: ct));
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM CourseJobCategories WHERE Course_pkid = @Pkid",
            new { Pkid = pkid }, tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Course WHERE pkid = @Pkid",
            new { Pkid = pkid }, tx, cancellationToken: ct));

        await _audit.LogDeleteAsync(conn, tx, TableName, row, ct);

        tx.Commit();
        return true;
    }

    // Delete-then-reinsert the CourseInCertification links for a course.
    private static async Task SyncCertificationsAsync(
        IDbConnection conn, IDbTransaction tx, int coursePkid, List<int> certificationPkids, CancellationToken ct)
    {
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM CourseInCertification WHERE Course_pkid = @Pkid",
            new { Pkid = coursePkid }, tx, cancellationToken: ct));

        var distinct = certificationPkids.Distinct().ToList();
        if (distinct.Count == 0) return;

        await conn.ExecuteAsync(new CommandDefinition(
            "INSERT INTO CourseInCertification (Course_pkid, Certification_pkid) VALUES (@Course_pkid, @Certification_pkid)",
            distinct.Select(id => new { Course_pkid = coursePkid, Certification_pkid = id }),
            tx, cancellationToken: ct));
    }

    // Delete-then-reinsert the CourseJobCategories links for a course.
    private static async Task SyncJobCategoriesAsync(
        IDbConnection conn, IDbTransaction tx, int coursePkid, List<short> jobCategoryPkids, CancellationToken ct)
    {
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM CourseJobCategories WHERE Course_pkid = @Pkid",
            new { Pkid = coursePkid }, tx, cancellationToken: ct));

        var distinct = jobCategoryPkids.Distinct().ToList();
        if (distinct.Count == 0) return;

        await conn.ExecuteAsync(new CommandDefinition(
            "INSERT INTO CourseJobCategories (Course_pkid, JobCategory_pkid) VALUES (@Course_pkid, @JobCategory_pkid)",
            distinct.Select(id => new { Course_pkid = coursePkid, JobCategory_pkid = id }),
            tx, cancellationToken: ct));
    }

    private static object ToInsertParams(CourseRequest r) => new
    {
        r.Title,
        r.OfficialTitle,
        r.CourseId,
        r.ProdCourseId,
        r.FriendlyUrl,
        r.DisplayOrder,
        r.Partner_pkid,
        r.CourseGroup_pkid,
        r.PublishStatus_pkid,
        r.ScheduleOn,
        r.ScheduleOff,
        r.Hour,
        r.ListPrice,
        r.LearningCredit,
        r.Material,
        r.Objective,
        r.Target,
        r.Prerequisites,
        r.Outline,
        r.TowardCertOrExam,
        r.Note,
        r.OtherInfo,
        r.CanRepeat
    };

    private static object ToUpdateParams(CourseRequest r) => new
    {
        r.Pkid,
        r.Title,
        r.OfficialTitle,
        r.CourseId,
        r.ProdCourseId,
        r.FriendlyUrl,
        r.DisplayOrder,
        r.Partner_pkid,
        r.CourseGroup_pkid,
        r.PublishStatus_pkid,
        r.ScheduleOn,
        r.ScheduleOff,
        r.Hour,
        r.ListPrice,
        r.LearningCredit,
        r.Material,
        r.Objective,
        r.Target,
        r.Prerequisites,
        r.Outline,
        r.TowardCertOrExam,
        r.Note,
        r.OtherInfo,
        r.CanRepeat
    };
}
