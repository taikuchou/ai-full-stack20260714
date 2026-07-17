using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/featured-promo-items")]
public class FeaturedPromoItemsController : ControllerBase
{
    private readonly IFeaturedPromoItemRepository _repository;

    public FeaturedPromoItemsController(IFeaturedPromoItemRepository repository)
        => _repository = repository;

    /// <summary>All featured promo items.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<FeaturedPromoItem>>> GetAll(CancellationToken ct)
        => Ok(await _repository.GetAllAsync(ct));

    /// <summary>
    /// Filtered search backing the schedule grid: one TrainingCenter tab, one Monday–Sunday week.
    /// Any date in <see cref="FeaturedPromoItemQuery.WeekStart"/> is snapped back to its Monday, so
    /// the client can send today's date and get the whole week around it.
    /// </summary>
    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<FeaturedPromoItem>>> Query(
        [FromBody] FeaturedPromoItemQuery query, CancellationToken ct)
    {
        var normalized = new FeaturedPromoItemQuery
        {
            TrainingCenterPkid = query.TrainingCenterPkid,
            WeekStart = query.WeekStart is null ? null : Week.MondayOf(query.WeekStart.Value),
            Keyword = query.Keyword
        };

        return Ok(await _repository.QueryAsync(normalized, ct));
    }

    /// <summary>Single item by pkid.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<FeaturedPromoItem>> GetById(int id, CancellationToken ct)
    {
        var item = await _repository.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>Create an item. pkid is assigned by the database.</summary>
    [HttpPost]
    public async Task<ActionResult<FeaturedPromoItem>> Create(
        [FromBody] FeaturedPromoItemRequest request, CancellationToken ct)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(error);

        var newId = await _repository.CreateAsync(request, ct);
        var created = await _repository.GetByIdAsync(newId, ct);
        return CreatedAtAction(nameof(GetById), new { id = newId }, created);
    }

    /// <summary>Update an item. pkid (key) is taken from the body.</summary>
    [HttpPut]
    public async Task<ActionResult<FeaturedPromoItem>> Update(
        [FromBody] FeaturedPromoItemRequest request, CancellationToken ct)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(error);

        var updated = await _repository.UpdateAsync(request, ct);
        if (!updated) return NotFound();

        return Ok(await _repository.GetByIdAsync(request.Pkid, ct));
    }

    /// <summary>Delete an item by pkid.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await _repository.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    /// <summary>
    /// Move an item one slot within its day: Delta +1 down (the grid's <c>+</c>), -1 up (<c>-</c>).
    /// Swaps with the target slot's occupant when there is one.
    /// </summary>
    [HttpPost("move")]
    public async Task<IActionResult> Move([FromBody] FeaturedPromoItemMoveRequest request, CancellationToken ct)
    {
        if (request.Delta != 1 && request.Delta != -1)
            return BadRequest("Delta must be 1 (down) or -1 (up).");

        var result = await _repository.MoveAsync(request.Pkid, request.Delta, ct);
        return result switch
        {
            MoveResult.Moved => NoContent(),
            MoveResult.NotFound => NotFound(),
            _ => BadRequest(
                $"Slot is already at the edge of the {FeaturedPromoItem.MinSlot}–{FeaturedPromoItem.MaxSlot} range.")
        };
    }

    // Required-field validation mirroring the NOT NULL columns, plus the slot range the grid renders.
    private static string? Validate(FeaturedPromoItemRequest request)
    {
        if (request.Slot < FeaturedPromoItem.MinSlot || request.Slot > FeaturedPromoItem.MaxSlot)
            return $"Slot must be between {FeaturedPromoItem.MinSlot} and {FeaturedPromoItem.MaxSlot}.";
        if (request.TrainingCenter_pkid <= 0)
            return "TrainingCenter_pkid is required.";
        if (request.Promotion_pkid <= 0)
            return "Promotion_pkid is required.";
        if (string.IsNullOrWhiteSpace(request.Topic))
            return "Topic is required.";
        if (string.IsNullOrWhiteSpace(request.Description))
            return "Description is required.";
        return null;
    }
}
