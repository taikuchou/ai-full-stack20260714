using CMS.API.Models;

namespace CMS.API.Repositories;

public interface ILookupRepository
{
    /// <summary>AppUser options for the role-assignment multiselect. Label = "UserName (UserId)".</summary>
    Task<IEnumerable<LookupItem>> GetAppUsersAsync(CancellationToken ct = default);

    /// <summary>AppRole options for the user role-assignment multiselect. Label = "RoleName (RoleId)".</summary>
    Task<IEnumerable<LookupItem>> GetAppRolesAsync(CancellationToken ct = default);

    /// <summary>PublishStatus options for FK dropdowns. Label = Description, Id = pkid.</summary>
    Task<IEnumerable<LookupItem>> GetPublishStatusesAsync(CancellationToken ct = default);

    /// <summary>Partner options for FK dropdowns. Label = Name, Id = pkid, ordered by DisplayOrder.</summary>
    Task<IEnumerable<LookupItem>> GetPartnersAsync(CancellationToken ct = default);

    /// <summary>CourseGroup options for FK dropdowns. Label = Description, Id = pkid, ordered by pkid.</summary>
    Task<IEnumerable<LookupItem>> GetCourseGroupsAsync(CancellationToken ct = default);

    /// <summary>Certification options for the Course n-n multiselect. Label = RTRIM(Title), Id = pkid.</summary>
    Task<IEnumerable<LookupItem>> GetCertificationsAsync(CancellationToken ct = default);

    /// <summary>JobCategory options for the Course n-n multiselect. Label = Description, Id = pkid.</summary>
    Task<IEnumerable<LookupItem>> GetJobCategoriesAsync(CancellationToken ct = default);

    /// <summary>
    /// TrainingCenter options for the FeaturedPromoItem grid tabs. Label = Name, Id = pkid,
    /// ordered by DisplayOrder.
    /// </summary>
    Task<IEnumerable<LookupItem>> GetTrainingCentersAsync(CancellationToken ct = default);

    /// <summary>
    /// Promotion2 options for the PromoCode autocomplete. Label = PromoCode, Id = pkid.
    /// </summary>
    Task<IEnumerable<LookupItem>> GetPromoCodesAsync(CancellationToken ct = default);

    /// <summary>
    /// Resolves a typed PromoCode to its Promotion2 pkid (plus Topic/Description to seed the form).
    /// Null when no promo carries that code. The match is exact — PromoCode is uniquely indexed.
    /// </summary>
    Task<PromoCodeLookup?> GetPromoCodeAsync(string promoCode, CancellationToken ct = default);
}
