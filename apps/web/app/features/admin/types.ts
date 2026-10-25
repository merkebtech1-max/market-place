export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";
export type UserRole = "USER" | "MODERATOR" | "ADMIN";
export type ListingStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "RESERVED" | "SOLD" | "EXPIRED" | "REMOVED";
export type ReportStatus = "PENDING" | "REVIEWING" | "RESOLVED" | "DISMISSED";
export type ReportTargetType = "LISTING" | "USER" | "MESSAGE";
export type ReportAction = "REMOVE_LISTING" | "SUSPEND_USER" | "DELETE_USER" | "REMOVE_MESSAGE" | "DISMISS";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminOverview {
  users: { total: number; active: number; suspended: number; deleted: number };
  listings: Record<"total" | "draft" | "pendingReview" | "active" | "reserved" | "sold" | "expired" | "removed", number>;
  reports: { total: number; pending: number; resolved: number; dismissed: number };
  reservations: { total: number; reserved: number; completed: number; cancelled: number; disputed: number; refunded: number };
}

export interface AdminUser {
  id: string;
  displayName: string | null;
  status: UserStatus;
  role: UserRole;
  ratingAvg: string;
  ratingCount: number;
  createdAt: string;
  activity: { activeListings: number; soldListings: number; removedListings: number; totalListings: number };
}

export interface AdminListing {
  id: string;
  title: string;
  priceCents: number;
  status: ListingStatus;
  condition: string;
  createdAt: string;
  seller: { id: string; displayName: string | null; status: UserStatus };
  category: { nameEn: string; nameAm: string } | null;
  city: { nameEn: string; nameAm: string } | null;
}

export interface AdminReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
  reporter: { id: string; displayName: string; status: UserStatus };
  target: Record<string, unknown> | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  target: string;
  diff: unknown;
  createdAt: string;
  actor: { id: string; displayName: string | null; role: UserRole } | null;
}

export interface PageResponse<T> {
  success: true;
  data: T[];
  pagination: Pagination;
}
