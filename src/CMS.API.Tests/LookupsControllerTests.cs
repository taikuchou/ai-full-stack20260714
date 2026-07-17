using CMS.API.Controllers;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="LookupsController"/>, focused on the lookups the FeaturedPromoItem
/// grid depends on: the TrainingCenter tab options and the PromoCode → Promotion_pkid resolve.
/// The repository is mocked so no database is required.
/// </summary>
public class LookupsControllerTests
{
    private readonly Mock<ILookupRepository> _repo = new(MockBehavior.Strict);
    private LookupsController CreateController() => new(_repo.Object);

    private static PromoCodeLookup SamplePromo() => new()
    {
        Pkid = 20,
        PromoCode = "20251204_SkillTrainAI",
        Topic = "成為能AI協作的程式設計師",
        Description = "轉職就業養成班，三大主流語言任你選"
    };

    // ---- TrainingCenter tabs ----

    [Fact]
    public async Task GetTrainingCenters_ReturnsOkWithOptionsInRepositoryOrder()
    {
        // The repository orders by DisplayOrder; the controller must not resort them.
        var centers = new[]
        {
            new LookupItem { Id = "1", Label = "台北" },
            new LookupItem { Id = "2", Label = "新竹" },
            new LookupItem { Id = "3", Label = "台中" }
        };
        _repo.Setup(r => r.GetTrainingCentersAsync(It.IsAny<CancellationToken>())).ReturnsAsync(centers);

        var result = await CreateController().GetTrainingCenters(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<LookupItem>>(ok.Value).ToList();
        Assert.Equal(3, payload.Count);
        Assert.Equal(["台北", "新竹", "台中"], payload.Select(c => c.Label));
    }

    // ---- PromoCode lookup: the autocomplete's option list ----

    [Fact]
    public async Task GetPromoCodes_ReturnsOkWithCodeOptions()
    {
        var codes = new[]
        {
            new LookupItem { Id = "20", Label = "20251204_SkillTrainAI" },
            new LookupItem { Id = "21", Label = "251211_GoogleAI" }
        };
        _repo.Setup(r => r.GetPromoCodesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(codes);

        var result = await CreateController().GetPromoCodes(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<LookupItem>>(ok.Value).ToList();
        Assert.Equal(2, payload.Count);
        // Id is the Promotion2 pkid the form stores as Promotion_pkid.
        Assert.Equal("20", payload[0].Id);
    }

    // ---- PromoCode lookup: resolving a typed code to Promotion_pkid ----

    [Fact]
    public async Task GetPromoCode_WhenFound_ReturnsOkWithPkidAndSeedFields()
    {
        _repo.Setup(r => r.GetPromoCodeAsync("20251204_SkillTrainAI", It.IsAny<CancellationToken>()))
             .ReturnsAsync(SamplePromo());

        var result = await CreateController().GetPromoCode("20251204_SkillTrainAI", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var promo = Assert.IsType<PromoCodeLookup>(ok.Value);
        Assert.Equal(20, promo.Pkid);
        Assert.Equal("20251204_SkillTrainAI", promo.PromoCode);
        Assert.Equal("成為能AI協作的程式設計師", promo.Topic);
        Assert.Equal("轉職就業養成班，三大主流語言任你選", promo.Description);
    }

    [Fact]
    public async Task GetPromoCode_WhenNoPromoCarriesTheCode_ReturnsNotFound()
    {
        _repo.Setup(r => r.GetPromoCodeAsync("NOPE", It.IsAny<CancellationToken>()))
             .ReturnsAsync((PromoCodeLookup?)null);

        var result = await CreateController().GetPromoCode("NOPE", CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task GetPromoCode_PassesTheCodeThroughVerbatim()
    {
        // The code is a string key: the controller must not trim, case-fold or otherwise touch it.
        const string code = "251211_GoogleAI";
        _repo.Setup(r => r.GetPromoCodeAsync(code, It.IsAny<CancellationToken>())).ReturnsAsync(SamplePromo());

        await CreateController().GetPromoCode(code, CancellationToken.None);

        _repo.Verify(r => r.GetPromoCodeAsync(code, It.IsAny<CancellationToken>()), Times.Once);
    }
}
