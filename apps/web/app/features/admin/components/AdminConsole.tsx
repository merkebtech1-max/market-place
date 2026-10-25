"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { ApiError } from "@/lib/api";
import { formatETB } from "@/lib/utils";
import {
  getAdminAuditLogs,
  getAdminListings,
  getAdminOverview,
  getAdminReports,
  getAdminUsers,
  moderateAdminListing,
  moderateAdminUser,
  resolveAdminReport,
} from "../queries";
import type {
  AdminListing,
  AdminOverview,
  AdminReport,
  AdminUser,
  AuditLogEntry,
  ReportAction,
  ReportStatus,
} from "../types";

export type AdminSection = "overview" | "moderation" | "users" | "audit";

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return "Sign in with a moderator or administrator account to continue.";
  if (error instanceof ApiError && error.status === 403) return "This account does not have moderator access.";
  return error instanceof Error ? error.message : "Unable to load the admin dashboard.";
}

function StatusBadge({ value }: { value: string }) {
  return <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{value.replaceAll("_", " ")}</span>;
}

function Loading() {
  return <div className="flex min-h-48 items-center justify-center"><Spinner /></div>;
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <EmptyState
      title="Admin data unavailable"
      body={message}
      action={
        <div className="flex gap-2">
          <Button onClick={retry}>Try again</Button>
          {message.startsWith("Sign in") && <Link href="/sign-in?next=/admin" className="tap-target inline-flex items-center text-sm font-semibold text-primary">Sign in</Link>}
        </div>
      }
    />
  );
}

function OverviewPanel() {
  const [data, setData] = useState<AdminOverview>();
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const next = await getAdminOverview(); setError(""); setData(next); } catch (cause) { setError(errorMessage(cause)); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    getAdminOverview()
      .then((next) => { if (!cancelled) { setError(""); setData(next); } })
      .catch((cause: unknown) => { if (!cancelled) setError(errorMessage(cause)); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <LoadError message={error} retry={load} />;
  if (!data) return <Loading />;

  const cards = [
    ["Users", data.users.total, `${data.users.active} active · ${data.users.suspended} suspended`],
    ["Listings", data.listings.total, `${data.listings.active} active · ${data.listings.removed} removed`],
    ["Reports", data.reports.total, `${data.reports.pending} awaiting review`],
    ["Reservations", data.reservations.total, `${data.reservations.completed} completed · ${data.reservations.disputed} disputed`],
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([title, value, detail]) => (
        <article key={title} className="rounded-card border border-border bg-surface p-5">
          <p className="text-sm font-medium text-ink-muted">{title}</p>
          <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
          <p className="mt-2 text-sm text-ink-muted">{detail}</p>
        </article>
      ))}
    </div>
  );
}

function ReportsPanel() {
  const [status, setStatus] = useState<ReportStatus>("PENDING");
  const [reports, setReports] = useState<AdminReport[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try { const next = await getAdminReports(status); setError(""); setReports(next); } catch (cause) { setError(errorMessage(cause)); }
  }, [status]);
  useEffect(() => {
    let cancelled = false;
    getAdminReports(status)
      .then((next) => { if (!cancelled) { setError(""); setReports(next); } })
      .catch((cause: unknown) => { if (!cancelled) setError(errorMessage(cause)); });
    return () => { cancelled = true; };
  }, [status]);

  const act = async (report: AdminReport, action: ReportAction) => {
    const resolution = resolutions[report.id]?.trim() || `Moderator selected ${action.replaceAll("_", " ").toLowerCase()}.`;
    setBusy(report.id);
    setError("");
    try { await resolveAdminReport(report.id, action, resolution); await load(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(undefined); }
  };

  if (error && !reports) return <LoadError message={error} retry={load} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-ink">Status
          <select value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)} className="ml-2 h-10 rounded-control border border-border bg-surface px-3">
            {(["PENDING", "REVIEWING", "RESOLVED", "DISMISSED"] as const).map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!reports ? <Loading /> : reports.length === 0 ? <EmptyState title="No reports in this queue" /> : (
        <div className="space-y-3">
          {reports.map((report) => (
            <article key={report.id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{report.targetType} report · {report.reason}</p>
                  <p className="text-sm text-ink-muted">Reported by {report.reporter.displayName} · {new Date(report.createdAt).toLocaleString()}</p>
                </div>
                <StatusBadge value={report.status} />
              </div>
              {report.note && <p className="mt-3 rounded-control bg-paper p-3 text-sm text-ink">{report.note}</p>}
              <p className="mt-2 break-all text-xs text-ink-muted">Target: {report.targetId}</p>
              {report.status === "PENDING" && (
                <div className="mt-4 space-y-3">
                  <input
                    value={resolutions[report.id] ?? ""}
                    onChange={(event) => setResolutions((current) => ({ ...current, [report.id]: event.target.value }))}
                    maxLength={1000}
                    placeholder="Moderation note (optional)"
                    className="h-10 w-full rounded-control border border-border bg-surface px-3 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    {report.targetType === "LISTING" && <Button size="sm" variant="danger" loading={busy === report.id} onClick={() => act(report, "REMOVE_LISTING")}>Remove listing</Button>}
                    {report.targetType === "USER" && <Button size="sm" variant="danger" loading={busy === report.id} onClick={() => act(report, "SUSPEND_USER")}>Suspend user</Button>}
                    {report.targetType === "USER" && <Button size="sm" variant="outline" disabled={busy === report.id} onClick={() => act(report, "DELETE_USER")}>Delete user</Button>}
                    {report.targetType === "MESSAGE" && <Button size="sm" variant="danger" loading={busy === report.id} onClick={() => act(report, "REMOVE_MESSAGE")}>Remove message</Button>}
                    <Button size="sm" variant="outline" disabled={busy === report.id} onClick={() => act(report, "DISMISS")}>Dismiss</Button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  const load = useCallback(async () => {
    try { const next = await getAdminUsers(search, status); setError(""); setUsers(next.data); } catch (cause) { setError(errorMessage(cause)); }
  }, [search, status]);
  useEffect(() => {
    let cancelled = false;
    getAdminUsers(search, status)
      .then((next) => { if (!cancelled) { setError(""); setUsers(next.data); } })
      .catch((cause: unknown) => { if (!cancelled) setError(errorMessage(cause)); });
    return () => { cancelled = true; };
  }, [search, status]);
  const act = async (user: AdminUser, action: "suspend" | "unsuspend" | "delete" | "restore") => {
    setBusy(user.id);
    try { await moderateAdminUser(user.id, action); await load(); } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(undefined); }
  };
  if (error && !users) return <LoadError message={error} retry={load} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search display name" className="h-10 min-w-56 flex-1 rounded-control border border-border bg-surface px-3 text-sm" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-control border border-border bg-surface px-3 text-sm">
          {["ALL", "ACTIVE", "SUSPENDED", "DELETED"].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!users ? <Loading /> : users.length === 0 ? <EmptyState title="No users found" /> : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-paper text-ink-muted"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Listings</th><th className="p-3">Actions</th></tr></thead>
            <tbody>{users.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="p-3"><p className="font-medium text-ink">{user.displayName || "Unnamed user"}</p><p className="text-xs text-ink-muted">{user.id}</p></td>
                <td className="p-3">{user.role}</td><td className="p-3"><StatusBadge value={user.status} /></td><td className="p-3">{user.activity.totalListings}</td>
                <td className="p-3"><div className="flex gap-2">
                  {user.role === "USER" && user.status === "ACTIVE" && <Button size="sm" variant="danger" loading={busy === user.id} onClick={() => act(user, "suspend")}>Suspend</Button>}
                  {user.role === "USER" && user.status === "SUSPENDED" && <Button size="sm" loading={busy === user.id} onClick={() => act(user, "unsuspend")}>Unsuspend</Button>}
                  {user.role === "USER" && user.status === "DELETED" && <Button size="sm" loading={busy === user.id} onClick={() => act(user, "restore")}>Restore</Button>}
                  {user.role === "USER" && user.status !== "DELETED" && <Button size="sm" variant="outline" disabled={busy === user.id} onClick={() => act(user, "delete")}>Delete</Button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ListingsPanel() {
  const [listings, setListings] = useState<AdminListing[]>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  const load = useCallback(async () => {
    try { const next = await getAdminListings(search, status); setError(""); setListings(next.data); } catch (cause) { setError(errorMessage(cause)); }
  }, [search, status]);
  useEffect(() => {
    let cancelled = false;
    getAdminListings(search, status)
      .then((next) => { if (!cancelled) { setError(""); setListings(next.data); } })
      .catch((cause: unknown) => { if (!cancelled) setError(errorMessage(cause)); });
    return () => { cancelled = true; };
  }, [search, status]);
  const act = async (listing: AdminListing, action: "remove" | "restore") => {
    setBusy(listing.id);
    try { await moderateAdminListing(listing.id, action); await load(); } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(undefined); }
  };
  if (error && !listings) return <LoadError message={error} retry={load} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search listings" className="h-10 min-w-56 flex-1 rounded-control border border-border bg-surface px-3 text-sm" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-control border border-border bg-surface px-3 text-sm">
          {["ALL", "DRAFT", "PENDING_REVIEW", "ACTIVE", "RESERVED", "SOLD", "EXPIRED", "REMOVED"].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!listings ? <Loading /> : listings.length === 0 ? <EmptyState title="No listings found" /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {listings.map((listing) => <article key={listing.id} className="rounded-card border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-ink">{listing.title}</p><p className="text-sm text-ink-muted">{listing.seller.displayName || "Unnamed seller"} · {formatETB(listing.priceCents, "en")}</p></div><StatusBadge value={listing.status} /></div>
            <p className="mt-2 text-xs text-ink-muted">{listing.category?.nameEn || "Uncategorized"} · {listing.city?.nameEn || "Unknown location"}</p>
            <div className="mt-3">{listing.status === "REMOVED" ? <Button size="sm" loading={busy === listing.id} onClick={() => act(listing, "restore")}>Restore</Button> : listing.status !== "SOLD" ? <Button size="sm" variant="danger" loading={busy === listing.id} onClick={() => act(listing, "remove")}>Remove</Button> : null}</div>
          </article>)}
        </div>
      )}
    </div>
  );
}

function AuditPanel() {
  const [logs, setLogs] = useState<AuditLogEntry[]>();
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const next = await getAdminAuditLogs(action); setError(""); setLogs(next.data); } catch (cause) { setError(errorMessage(cause)); }
  }, [action]);
  useEffect(() => {
    let cancelled = false;
    getAdminAuditLogs(action)
      .then((next) => { if (!cancelled) { setError(""); setLogs(next.data); } })
      .catch((cause: unknown) => { if (!cancelled) setError(errorMessage(cause)); });
    return () => { cancelled = true; };
  }, [action]);
  if (error && !logs) return <LoadError message={error} retry={load} />;
  return <div className="space-y-4">
    <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Filter by action" className="h-10 w-full rounded-control border border-border bg-surface px-3 text-sm sm:max-w-sm" />
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!logs ? <Loading /> : logs.length === 0 ? <EmptyState title="No audit entries found" /> : <div className="space-y-2">{logs.map((log) => <article key={log.id} className="rounded-control border border-border bg-surface p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-ink">{log.action}</p><time className="text-xs text-ink-muted">{new Date(log.createdAt).toLocaleString()}</time></div><p className="mt-1 break-all text-sm text-ink-muted">Target: {log.target}</p><p className="text-xs text-ink-muted">Actor: {log.actor?.displayName || log.actor?.id || "System"}</p></article>)}</div>}
  </div>;
}

export function AdminConsole({ section }: { section: AdminSection }) {
  const title = { overview: "Admin overview", moderation: "Moderation", users: "Users", audit: "Audit log" }[section];
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6">
      <div className="mb-6"><p className="text-sm font-semibold text-primary">Merkeb Market administration</p><h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1></div>
      {section === "overview" && <OverviewPanel />}
      {section === "moderation" && <div className="space-y-8"><section><h2 className="mb-3 text-xl font-semibold text-ink">Reports</h2><ReportsPanel /></section><section><h2 className="mb-3 text-xl font-semibold text-ink">Listings</h2><ListingsPanel /></section></div>}
      {section === "users" && <UsersPanel />}
      {section === "audit" && <AuditPanel />}
    </main>
  );
}
