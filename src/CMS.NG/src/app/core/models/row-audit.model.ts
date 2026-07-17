/** One entry of a record's audit trail, from GET /api/rowaudit. */
export interface RowAuditHistoryItem {
  /**
   * When the change happened, as an ISO string **in UTC without an offset**
   * (e.g. `2026-06-04T06:30:00`) — the API stamps UtcNow into a plain `datetime` column.
   * Parse it with `parseUtc()`, never `new Date(value)`: JS reads an offset-less string as
   * local time, which would show a UTC+8 reader every audit time 8 hours early.
   */
  dateTime: string;
  userName: string;
  actionType: string;
  actionDesc: string | null;
}
