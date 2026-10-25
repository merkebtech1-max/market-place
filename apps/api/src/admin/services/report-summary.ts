import { ReportStatus } from '../../generated/prisma/enums.js';

/** Historical per-target report counts, always with all four fields. */
export interface ReportSummary {
  total: number;
  pending: number;
  resolved: number;
  dismissed: number;
}

export function emptyReportSummary(): ReportSummary {
  return { total: 0, pending: 0, resolved: 0, dismissed: 0 };
}

/**
 * Collapse (status, count) groups into a single ReportSummary. REVIEWING
 * rows are internal temporary-claim state: they count toward `total` but
 * are not exposed as their own bucket.
 */
export function summarizeReportGroups<Group extends { status: ReportStatus; _count: { _all: number } }>(
  groups: Group[],
): ReportSummary {
  const summary = emptyReportSummary();

  for (const group of groups) {
    const count = group._count._all;
    summary.total += count;
    if (group.status === ReportStatus.PENDING) summary.pending += count;
    else if (group.status === ReportStatus.RESOLVED) summary.resolved += count;
    else if (group.status === ReportStatus.DISMISSED) summary.dismissed += count;
  }

  return summary;
}

/** Collapse grouped (id, status, count) rows into per-id ReportSummary maps. */
export function buildReportSummaryMap<Group extends { status: ReportStatus; _count: { _all: number } }>(
  groups: Group[],
  getId: (group: Group) => string | null,
): Map<string, ReportSummary> {
  const summariesById = new Map<string, ReportSummary>();

  for (const group of groups) {
    const id = getId(group);
    if (!id) continue;

    const summary = summariesById.get(id) ?? emptyReportSummary();
    const count = group._count._all;
    summary.total += count;
    if (group.status === ReportStatus.PENDING) summary.pending += count;
    else if (group.status === ReportStatus.RESOLVED) summary.resolved += count;
    else if (group.status === ReportStatus.DISMISSED) summary.dismissed += count;
    summariesById.set(id, summary);
  }

  return summariesById;
}
