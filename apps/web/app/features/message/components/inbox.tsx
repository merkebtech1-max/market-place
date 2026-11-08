"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { InboxIcon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { ButtonLink } from "@/components/ui/Button";
import { useLanguage } from "@/il8n/LanguageProvider";
import {
  getIsAuthenticated,
  getServerIsAuthenticated,
  subscribeAuthSession,
} from "@/lib/auth";
import { cn, formatRelativeTime } from "@/lib/utils";
import { getConversation, getConversations } from "../queries";
import type { Conversation } from "../types";

type Tab = "all" | "buying" | "selling";

export function Inbox() {
  const { t, locale } = useLanguage();
  const isAuthenticated = useSyncExternalStore(
    subscribeAuthSession,
    getIsAuthenticated,
    getServerIsAuthenticated
  );
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const listingId = useSearchParams().get("listing");

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;
    // "Message seller" from a listing: show the inbox with that chat ready at the top.
    void Promise.all([getConversations(), listingId ? getConversation(`l-${listingId}`) : null])
      .then(([all, started]) => {
        if (!cancelled) {
          setItems(started ? [started, ...all.filter((item) => item.id !== started.id)] : all);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setItems([]);
          setLoadError(error instanceof Error ? error.message : t("chat.loadError"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, listingId, t]);

  const shown = items?.filter((c) => tab === "all" || c.role === tab);

  if (!isAuthenticated) {
    const next = listingId ? `/messages?listing=${encodeURIComponent(listingId)}` : "/messages";
    return (
      <Container className="max-w-md px-3 py-10">
        <EmptyState
          icon={<InboxIcon />}
          title={t("chat.signInTitle")}
          body={t("chat.signInBody")}
          action={
            <ButtonLink href={`/sign-in?mode=login&next=${encodeURIComponent(next)}`}>
              {t("header.signIn")}
            </ButtonLink>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="max-w-2xl px-3 py-4 sm:py-8">
      <h1 className="mb-3 text-xl font-bold text-ink">{t("chat.title")}</h1>
      {loadError && <p role="alert" className="mb-3 rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{loadError}</p>}
      <div role="tablist" aria-label={t("chat.title")} className="mb-3 flex gap-2">
        {(["all", "buying", "selling"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "tap-target rounded-full px-4 text-sm font-medium",
              tab === k ? "bg-primary text-white" : "bg-primary-soft text-primary"
            )}
          >
            {t(`chat.tab.${k}`)}
          </button>
        ))}
      </div>

      {!shown ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState icon={<InboxIcon />} title={t("chat.emptyTitle")} body={t("chat.emptyBody")} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {shown.map((c) => {
            const last = c.messages.at(-1);
            const preview = !last
              ? t("chat.startChat")
              : last.kind === "offer"
                ? t("chat.offerPreview")
                : (last.body ?? "");
            return (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-primary-soft/40"
                >
                  <Avatar name={c.peerName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn("truncate text-sm text-ink", c.unread ? "font-bold" : "font-semibold")}>
                        {c.peerName}
                      </p>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {last ? formatRelativeTime(last.sentAt, locale) : ""}
                      </span>
                    </div>
                    <p className="truncate text-xs text-ink-muted">{c.listingTitle}</p>
                    <p className={cn("truncate text-sm", c.unread ? "font-medium text-ink" : "text-ink-muted")}>
                      {last?.mine ? `${t("chat.you")}: ` : ""}
                      {preview}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span
                      aria-label={t("chat.unread", { count: c.unread })}
                      className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white"
                    >
                      {c.unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
