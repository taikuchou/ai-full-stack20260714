using System.Data;
using CMS.API.Auditing;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class FeaturedPromoItemRepository : IFeaturedPromoItemRepository
{
    private const string TableName = "FeaturedPromoItem";

    private readonly IDbConnectionFactory _factory;
    private readonly IRowAuditWriter _audit;

    public FeaturedPromoItemRepository(IDbConnectionFactory factory, IRowAuditWriter audit)
    {
        _factory = factory;
        _audit = audit;
    }

    // Slot the moving row's counterpart parks on mid-swap. Never persisted: the transaction always
    // lands it on a real 1-3 slot before committing.
    private const byte ParkingSlot = 0;

    // Shared SELECT for grid/view. Both FKs are NOT NULL, but LEFT JOIN keeps a row visible in the
    // grid even if a referenced promo/centre is missing, rather than silently dropping it.
    private const string SelectList = @"
SELECT f.pkid                 AS Pkid,
       f.ScheduleOn           AS ScheduleOn,
       f.TrainingCenter_pkid  AS TrainingCenter_pkid,
       f.Slot                 AS Slot,
       f.Promotion_pkid       AS Promotion_pkid,
       f.Topic                AS Topic,
       f.Description          AS Description,
       t.Name                 AS TrainingCenterName,
       p.PromoCode            AS PromoCode
FROM FeaturedPromoItem f
LEFT JOIN TrainingCenter t ON t.pkid = f.TrainingCenter_pkid
LEFT JOIN Promotion2     p ON p.pkid = f.Promotion_pkid";

    public async Task<IEnumerable<FeaturedPromoItem>> GetAllAsync(CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<FeaturedPromoItem>(new CommandDefinition(
            $"{SelectList} ORDER BY f.ScheduleOn ASC, f.TrainingCenter_pkid ASC, f.Slot ASC",
            cancellationToken: ct));
    }

    public async Task<IEnumerable<FeaturedPromoItem>> QueryAsync(
        FeaturedPromoItemQuery query, CancellationToken ct = default)
    {
        var sql = $@"{SelectList}
WHERE (@TrainingCenterPkid IS NULL OR f.TrainingCenter_pkid = @TrainingCenterPkid)
  AND (@WeekStart          IS NULL OR f.ScheduleOn >= @WeekStart)
  AND (@WeekEnd            IS NULL OR f.ScheduleOn <= @WeekEnd)
  AND (@Keyword            IS NULL
        OR f.Topic LIKE @KeywordLike
        OR f.Description LIKE @KeywordLike
        OR p.PromoCode LIKE @KeywordLike)
ORDER BY f.ScheduleOn ASC, f.Slot ASC";

        var keyword = string.IsNullOrWhiteSpace(query.Keyword) ? null : query.Keyword.Trim();
        var parameters = new
        {
            query.TrainingCenterPkid,
            query.WeekStart,
            // Inclusive Sunday. WeekStart is already snapped to Monday by the controller.
            WeekEnd = query.WeekStart?.AddDays(Week.Days - 1),
            Keyword = keyword,
            KeywordLike = keyword is null ? null : $"%{keyword}%"
        };

        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await conn.QueryAsync<FeaturedPromoItem>(
            new CommandDefinition(sql, parameters, cancellationToken: ct));
    }

    public async Task<FeaturedPromoItem?> GetByIdAsync(int pkid, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        return await LoadAsync(conn, null, pkid, ct);
    }

    public async Task<int> CreateAsync(FeaturedPromoItemRequest request, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        // pkid is IDENTITY — omit from the column list; return the DB-assigned value.
        var newId = await conn.ExecuteScalarAsync<int>(new CommandDefinition(@"
INSERT INTO FeaturedPromoItem
  (ScheduleOn, TrainingCenter_pkid, Slot, Promotion_pkid, Topic, Description)
VALUES
  (@ScheduleOn, @TrainingCenter_pkid, @Slot, @Promotion_pkid, @Topic, @Description);
SELECT CAST(SCOPE_IDENTITY() AS int);",
            new
            {
                request.ScheduleOn,
                request.TrainingCenter_pkid,
                request.Slot,
                request.Promotion_pkid,
                request.Topic,
                request.Description
            },
            tx, cancellationToken: ct));

        await _audit.LogInsertAsync(conn, tx, TableName, await RequireAsync(conn, tx, newId, ct), ct);

        tx.Commit();
        return newId;
    }

    public async Task<bool> UpdateAsync(FeaturedPromoItemRequest request, CancellationToken ct = default)
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
UPDATE FeaturedPromoItem
SET ScheduleOn = @ScheduleOn,
    TrainingCenter_pkid = @TrainingCenter_pkid,
    Slot = @Slot,
    Promotion_pkid = @Promotion_pkid,
    Topic = @Topic,
    Description = @Description
WHERE pkid = @Pkid;",
            new
            {
                request.Pkid,
                request.ScheduleOn,
                request.TrainingCenter_pkid,
                request.Slot,
                request.Promotion_pkid,
                request.Topic,
                request.Description
            },
            tx, cancellationToken: ct));

        if (affected == 0)
        {
            tx.Rollback();
            return false;
        }

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

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM FeaturedPromoItem WHERE pkid = @Pkid",
            new { Pkid = pkid }, tx, cancellationToken: ct));

        await _audit.LogDeleteAsync(conn, tx, TableName, row, ct);

        tx.Commit();
        return true;
    }

    public async Task<MoveResult> MoveAsync(int pkid, int delta, CancellationToken ct = default)
    {
        using var conn = await _factory.CreateOpenConnectionAsync(ct);
        using var tx = conn.BeginTransaction();

        var item = await conn.QueryFirstOrDefaultAsync<SlotRow>(new CommandDefinition(@"
SELECT pkid                AS Pkid,
       ScheduleOn          AS ScheduleOn,
       TrainingCenter_pkid AS TrainingCenterPkid,
       Slot                AS Slot
FROM FeaturedPromoItem
WHERE pkid = @Pkid",
            new { Pkid = pkid }, tx, cancellationToken: ct));

        if (item is null)
        {
            tx.Rollback();
            return MoveResult.NotFound;
        }

        var target = item.Slot + delta;
        if (target < FeaturedPromoItem.MinSlot || target > FeaturedPromoItem.MaxSlot)
        {
            tx.Rollback();
            return MoveResult.OutOfRange;
        }

        var occupantPkid = await conn.ExecuteScalarAsync<int?>(new CommandDefinition(@"
SELECT pkid FROM FeaturedPromoItem
WHERE ScheduleOn = @ScheduleOn
  AND TrainingCenter_pkid = @TrainingCenterPkid
  AND Slot = @Slot",
            new { item.ScheduleOn, item.TrainingCenterPkid, Slot = (byte)target },
            tx, cancellationToken: ct));

        // Captured before any slot is touched: the audit records the net move, never the
        // intermediate parking-slot state.
        var movedBefore = await RequireAsync(conn, tx, pkid, ct);
        var occupantBefore = occupantPkid is null
            ? null
            : await RequireAsync(conn, tx, occupantPkid.Value, ct);

        if (occupantPkid is null)
        {
            await SetSlotAsync(conn, tx, pkid, (byte)target, ct);
        }
        else
        {
            // IX_FeaturedPromoItem_UniqueDateLocSlot forbids two rows sharing the target slot even
            // momentarily, so park the occupant off-range, move, then land it on the vacated slot.
            await SetSlotAsync(conn, tx, occupantPkid.Value, ParkingSlot, ct);
            await SetSlotAsync(conn, tx, pkid, (byte)target, ct);
            await SetSlotAsync(conn, tx, occupantPkid.Value, item.Slot, ct);
        }

        // A swap moves two rows, so it audits two — one per row that actually changed.
        await _audit.LogUpdateAsync(
            conn, tx, TableName, movedBefore, await RequireAsync(conn, tx, pkid, ct), ct);

        if (occupantBefore is not null)
        {
            await _audit.LogUpdateAsync(
                conn, tx, TableName, occupantBefore,
                await RequireAsync(conn, tx, occupantPkid!.Value, ct), ct);
        }

        tx.Commit();
        return MoveResult.Moved;
    }

    private static Task<FeaturedPromoItem?> LoadAsync(
        IDbConnection conn, IDbTransaction? tx, int pkid, CancellationToken ct)
        => conn.QueryFirstOrDefaultAsync<FeaturedPromoItem>(new CommandDefinition(
            $"{SelectList} WHERE f.pkid = @Pkid", new { Pkid = pkid }, tx, cancellationToken: ct));

    /// <summary>Loads a row that must exist because the caller just wrote or located it in this transaction.</summary>
    private static async Task<FeaturedPromoItem> RequireAsync(
        IDbConnection conn, IDbTransaction tx, int pkid, CancellationToken ct)
        => await LoadAsync(conn, tx, pkid, ct)
           ?? throw new InvalidOperationException($"{TableName} {pkid} is missing immediately after being written.");

    private static Task SetSlotAsync(
        IDbConnection conn, IDbTransaction tx, int pkid, byte slot, CancellationToken ct) =>
        conn.ExecuteAsync(new CommandDefinition(
            "UPDATE FeaturedPromoItem SET Slot = @Slot WHERE pkid = @Pkid",
            new { Pkid = pkid, Slot = slot }, tx, cancellationToken: ct));

    /// <summary>The grid coordinates of a row — all MoveAsync needs to find its neighbour.</summary>
    private sealed class SlotRow
    {
        public int Pkid { get; set; }
        public DateOnly ScheduleOn { get; set; }
        public short TrainingCenterPkid { get; set; }
        public byte Slot { get; set; }
    }
}
