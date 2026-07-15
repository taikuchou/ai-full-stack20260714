/** Response model for a FeaturedPromoItem (上稿作業) — one promo pinned to a day/centre/slot cell. */
export interface FeaturedPromoItem {
  /** Primary key (主代碼). int IDENTITY, database-assigned. */
  pkid: number;

  /** ISO date string (yyyy-MM-dd). A pure `date` column — no timezone component. */
  scheduleOn: string;
  trainingCenter_pkid: number;

  /** Position within the day's column, 1–3. */
  slot: number;
  promotion_pkid: number;
  topic: string;
  description: string;

  /** FK label fields (read-only, resolved server-side via JOIN) — used by the grid columns. */
  trainingCenterName: string | null;
  promoCode: string | null;
}

/** Write DTO for creating / updating an item. `pkid` is DB-assigned (0 on create). */
export interface FeaturedPromoItemRequest {
  pkid: number;
  scheduleOn: string;
  trainingCenter_pkid: number;
  slot: number;
  promotion_pkid: number;
  topic: string;
  description: string;
}

/** Search DTO for the grid: one TrainingCenter tab, one Monday–Sunday week. */
export interface FeaturedPromoItemQuery {
  trainingCenterPkid?: number | null;
  /** Any date inside the week; the API snaps it back to that week's Monday. */
  weekStart?: string | null;
  keyword?: string | null;
}

/** Body for the slot-move endpoint: `delta` +1 moves down (+), -1 moves up (-). */
export interface FeaturedPromoItemMoveRequest {
  pkid: number;
  delta: number;
}

/** Result of resolving a typed PromoCode to its Promotion2 pkid. */
export interface PromoCodeLookup {
  pkid: number;
  promoCode: string;
  topic: string;
  description: string;
}

/** Slim option item for select / autocomplete controls. */
export interface LookupItem {
  id: string;
  label: string;
}
