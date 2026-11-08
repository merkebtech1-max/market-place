import { authenticatedApiRequest } from "@/lib/auth";
import type {
  AdminListing,
  AdminOverview,
  AdminReport,
  AdminUser,
  AuditLogEntry,
  PageResponse,
  ReportAction,
  ReportStatus,
  ReportTargetType,
} from "./types";

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

export async function getAdminOverview() {
  const response = await authenticatedApiRequest<{ success: true; data: AdminOverview }>("/admin/overview", { cache: "no-store" });
  return response.data;
}

export async function getAdminReports(status: ReportStatus = "PENDING", targetType?: ReportTargetType) {
  const response = await authenticatedApiRequest<{ success: true; data: AdminReport[] }>(
    `/admin/reports${queryString({ status, targetType })}`,
    { cache: "no-store" }
  );
  return response.data;
}

export async function getAdminUsers(search = "", status = "ALL") {
  return authenticatedApiRequest<PageResponse<AdminUser>>(
    `/admin/users${queryString({ search: search || undefined, status, limit: 50 })}`,
    { cache: "no-store" }
  );
}

export async function getAdminListings(search = "", status = "ALL") {
  return authenticatedApiRequest<PageResponse<AdminListing>>(
    `/admin/listings${queryString({ search: search || undefined, status, limit: 50 })}`,
    { cache: "no-store" }
  );
}

export async function getAdminAuditLogs(action = "") {
  return authenticatedApiRequest<PageResponse<AuditLogEntry>>(
    `/admin/audit-logs${queryString({ action: action || undefined, limit: 50 })}`,
    { cache: "no-store" }
  );
}

export function resolveAdminReport(reportId: string, action: ReportAction, resolution: string) {
  return authenticatedApiRequest<{ success: true }>(`/admin/reports/${reportId}`, {
    method: "PATCH",
    body: JSON.stringify({ action, resolution }),
  });
}

export function moderateAdminUser(userId: string, action: "suspend" | "unsuspend" | "delete" | "restore") {
  return authenticatedApiRequest<{ success: true }>(`/admin/users/${userId}/${action}`, { method: "PATCH" });
}

export function moderateAdminListing(listingId: string, action: "remove" | "restore") {
  return authenticatedApiRequest<{ success: true }>(`/admin/listings/${listingId}/${action}`, { method: "PATCH" });
}
