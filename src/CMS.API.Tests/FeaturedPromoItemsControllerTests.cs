using CMS.API.Controllers;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace CMS.API.Tests;

/// <summary>
/// Unit tests for <see cref="FeaturedPromoItemsController"/> covering the FeaturedPromoItem
/// endpoints: list, filtered query (the one-week ScheduleOn window and the TrainingCenter tab),
/// view, add, edit, delete and the slot move. The repository is mocked so no database is required.
/// </summary>
public class FeaturedPromoItemsControllerTests
{
    private readonly Mock<IFeaturedPromoItemRepository> _repo = new(MockBehavior.Strict);
    private FeaturedPromoItemsController CreateController() => new(_repo.Object);

    // 2026-03-16 is the Monday of the week the mockups show (3/16 -- 3/22).
    private static readonly DateOnly Monday = new(2026, 3, 16);

    private static FeaturedPromoItem SampleItem(int pkid = 1, byte slot = 1) => new()
    {
        Pkid = pkid,
        ScheduleOn = Monday,
        TrainingCenter_pkid = 1,
        Slot = slot,
        Promotion_pkid = 20,
        Topic = "成為能AI協作的程式設計師",
        Description = "轉職就業養成班，三大主流語言任你選",
        TrainingCenterName = "台北",
        PromoCode = "20251204_SkillTrainAI"
    };

    private static FeaturedPromoItemRequest ValidRequest(int pkid = 0) => new()
    {
        Pkid = pkid,
        ScheduleOn = Monday,
        TrainingCenter_pkid = 1,
        Slot = 1,
        Promotion_pkid = 20,
        Topic = "成為能AI協作的程式設計師",
        Description = "轉職就業養成班，三大主流語言任你選"
    };

    /// <summary>Runs Query and hands back the DTO the controller actually passed to the repository.</summary>
    private async Task<FeaturedPromoItemQuery> CaptureQueryAsync(FeaturedPromoItemQuery input)
    {
        FeaturedPromoItemQuery? captured = null;
        _repo.Setup(r => r.QueryAsync(It.IsAny<FeaturedPromoItemQuery>(), It.IsAny<CancellationToken>()))
             .Callback<FeaturedPromoItemQuery, CancellationToken>((q, _) => captured = q)
             .ReturnsAsync([SampleItem()]);

        await CreateController().Query(input, CancellationToken.None);

        Assert.NotNull(captured);
        return captured!;
    }

    // ---- List ----

    [Fact]
    public async Task GetAll_ReturnsOkWithAllItems()
    {
        var items = new[] { SampleItem(1), SampleItem(2, 2) };
        _repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(items);

        var result = await CreateController().GetAll(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<FeaturedPromoItem>>(ok.Value);
        Assert.Equal(2, payload.Count());
    }

    // ---- Filtered query: the one-week ScheduleOn window ----

    /// <summary>
    /// Any day of the week the client sends must resolve to the same Monday, so the grid shows the
    /// whole Monday–Sunday week around the requested date.
    /// </summary>
    [Theory]
    [InlineData(2026, 3, 16)] // Monday itself
    [InlineData(2026, 3, 17)] // Tuesday
    [InlineData(2026, 3, 18)] // Wednesday
    [InlineData(2026, 3, 19)] // Thursday
    [InlineData(2026, 3, 20)] // Friday
    [InlineData(2026, 3, 21)] // Saturday
    [InlineData(2026, 3, 22)] // Sunday — must snap back, not forward
    public async Task Query_SnapsWeekStartToTheMondayOfThatWeek(int year, int month, int day)
    {
        var captured = await CaptureQueryAsync(new FeaturedPromoItemQuery
        {
            TrainingCenterPkid = 1,
            WeekStart = new DateOnly(year, month, day)
        });

        Assert.Equal(Monday, captured.WeekStart);
    }

    [Fact]
    public async Task Query_WhenWeekStartOmitted_LeavesItNullSoNoDateFilterApplies()
    {
        var captured = await CaptureQueryAsync(new FeaturedPromoItemQuery { TrainingCenterPkid = 1 });

        Assert.Null(captured.WeekStart);
    }

    [Fact]
    public async Task Query_SnappedWeekStartCoversExactlySevenDaysThroughSunday()
    {
        var captured = await CaptureQueryAsync(new FeaturedPromoItemQuery { WeekStart = new DateOnly(2026, 3, 19) });

        // The repository derives the inclusive upper bound as WeekStart + (Week.Days - 1).
        var weekEnd = captured.WeekStart!.Value.AddDays(Week.Days - 1);
        Assert.Equal(Monday, captured.WeekStart);
        Assert.Equal(new DateOnly(2026, 3, 22), weekEnd);
        Assert.Equal(DayOfWeek.Sunday, weekEnd.DayOfWeek);
    }

    // ---- Filtered query: the TrainingCenter tab ----

    [Fact]
    public async Task Query_PassesTrainingCenterPkidThroughToRepository()
    {
        var captured = await CaptureQueryAsync(new FeaturedPromoItemQuery
        {
            TrainingCenterPkid = 3,
            WeekStart = Monday
        });

        Assert.Equal((short)3, captured.TrainingCenterPkid);
    }

    [Fact]
    public async Task Query_WhenTrainingCenterOmitted_LeavesItNullSoAllCentersMatch()
    {
        var captured = await CaptureQueryAsync(new FeaturedPromoItemQuery { WeekStart = Monday });

        Assert.Null(captured.TrainingCenterPkid);
    }

    [Fact]
    public async Task Query_ReturnsOkWithMatches_AndCallsRepositoryOnce()
    {
        var query = new FeaturedPromoItemQuery { TrainingCenterPkid = 1, WeekStart = Monday };
        _repo.Setup(r => r.QueryAsync(It.IsAny<FeaturedPromoItemQuery>(), It.IsAny<CancellationToken>()))
             .ReturnsAsync([SampleItem(1)]);

        var result = await CreateController().Query(query, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsAssignableFrom<IEnumerable<FeaturedPromoItem>>(ok.Value);
        Assert.Single(payload);
        _repo.Verify(
            r => r.QueryAsync(It.IsAny<FeaturedPromoItemQuery>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Query_ForwardsKeywordUntouched()
    {
        var captured = await CaptureQueryAsync(new FeaturedPromoItemQuery { Keyword = "GoogleAI" });

        Assert.Equal("GoogleAI", captured.Keyword);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_WhenFound_ReturnsOkWithItem()
    {
        _repo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(SampleItem(1));

        var result = await CreateController().GetById(1, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var item = Assert.IsType<FeaturedPromoItem>(ok.Value);
        Assert.Equal(1, item.Pkid);
        Assert.Equal("20251204_SkillTrainAI", item.PromoCode);
    }

    [Fact]
    public async Task GetById_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.GetByIdAsync(99, It.IsAny<CancellationToken>())).ReturnsAsync((FeaturedPromoItem?)null);

        var result = await CreateController().GetById(99, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_WhenValid_ReturnsCreatedAtActionWithNewPkid()
    {
        var request = ValidRequest();
        _repo.Setup(r => r.CreateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(7);
        _repo.Setup(r => r.GetByIdAsync(7, It.IsAny<CancellationToken>())).ReturnsAsync(SampleItem(7));

        var result = await CreateController().Create(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(FeaturedPromoItemsController.GetById), created.ActionName);
        Assert.Equal(7, created.RouteValues!["id"]);
        _repo.Verify(r => r.CreateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData((byte)0)] // below the grid
    [InlineData((byte)4)] // above the grid
    public async Task Create_WhenSlotOutsideOneToThree_ReturnsBadRequest(byte slot)
    {
        var request = ValidRequest();
        request.Slot = slot;

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_WhenPromotionMissing_ReturnsBadRequest()
    {
        var request = ValidRequest();
        request.Promotion_pkid = 0;

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_WhenTopicMissing_ReturnsBadRequest()
    {
        var request = ValidRequest();
        request.Topic = "";

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_WhenDescriptionMissing_ReturnsBadRequest()
    {
        var request = ValidRequest();
        request.Description = "   ";

        var result = await CreateController().Create(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_WhenFound_ReturnsOkWithUpdatedItem()
    {
        var request = ValidRequest(1);
        request.Topic = "成為能AI協作的程式設計師（已編輯）";
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _repo.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(SampleItem(1));

        var result = await CreateController().Update(request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.IsType<FeaturedPromoItem>(ok.Value);
        _repo.Verify(r => r.UpdateAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Update_WhenMissing_ReturnsNotFound()
    {
        var request = ValidRequest(99);
        _repo.Setup(r => r.UpdateAsync(request, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().Update(request, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Update_WhenTopicMissing_ReturnsBadRequest()
    {
        var request = ValidRequest(1);
        request.Topic = "";

        var result = await CreateController().Update(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ---- Delete ----

    [Fact]
    public async Task Delete_WhenFound_ReturnsNoContent()
    {
        _repo.Setup(r => r.DeleteAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await CreateController().Delete(1, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task Delete_WhenMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.DeleteAsync(99, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await CreateController().Delete(99, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    // ---- Slot move (the grid's + / - links) ----

    [Theory]
    [InlineData(1)]  // + : down a slot
    [InlineData(-1)] // - : up a slot
    public async Task Move_WhenMoved_ReturnsNoContent(int delta)
    {
        _repo.Setup(r => r.MoveAsync(1, delta, It.IsAny<CancellationToken>())).ReturnsAsync(MoveResult.Moved);

        var result = await CreateController().Move(
            new FeaturedPromoItemMoveRequest { Pkid = 1, Delta = delta }, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        _repo.Verify(r => r.MoveAsync(1, delta, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Move_WhenItemMissing_ReturnsNotFound()
    {
        _repo.Setup(r => r.MoveAsync(99, 1, It.IsAny<CancellationToken>())).ReturnsAsync(MoveResult.NotFound);

        var result = await CreateController().Move(
            new FeaturedPromoItemMoveRequest { Pkid = 99, Delta = 1 }, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Move_WhenAlreadyAtEdgeOfSlotRange_ReturnsBadRequest()
    {
        _repo.Setup(r => r.MoveAsync(1, -1, It.IsAny<CancellationToken>())).ReturnsAsync(MoveResult.OutOfRange);

        var result = await CreateController().Move(
            new FeaturedPromoItemMoveRequest { Pkid = 1, Delta = -1 }, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    [InlineData(-2)]
    public async Task Move_WhenDeltaIsNotOneStep_ReturnsBadRequestWithoutTouchingRepository(int delta)
    {
        var result = await CreateController().Move(
            new FeaturedPromoItemMoveRequest { Pkid = 1, Delta = delta }, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        _repo.Verify(
            r => r.MoveAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
