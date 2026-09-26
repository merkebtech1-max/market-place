"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { BellIcon, ChatIcon, ShieldIcon, TagIcon, MapPinIcon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLanguage } from "@/il8n/LanguageProvider";
import { cn, formatRelativeTime } from "@/lib/utils";
import { getNotifications } from "../queries";
import { defaultPrefs, type AppNotification, type NotificationPrefs, type NotificationType } from "../types";

const ICONS = {
  message: ChatIcon,
  offer: TagIcon,
  priceDrop: TagIcon,
  moderation: ShieldIcon,
  meetup: MapPinIcon,
} as const;

const PREFS_KEY = "merkeb.notifPrefs";

function loadPrefs(): NotificationPrefs {
  try {
    return { ...defaultPrefs, ...JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return defaultPrefs;
  }
}

type PushState = "unsupported" | NotificationPermission;

export function NotificationsView() {
  const { t, locale } = useLanguage();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [tab, setTab] = useState<"feed" | "settings">("feed");
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [push, setPush] = useState<PushState>("default");

  useEffect(() => {
    getNotifications().then(setItems);
    // Reading browser-only state (localStorage / Notification API) after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setPrefs(loadPrefs());
    setPush(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const togglePref = (k: NotificationType) => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Private mode — preference just won't persist.
    }
  };

  const enablePush = async () => {
    if (typeof Notification === "undefined") return;
    setPush(await Notification.requestPermission());
  };

  const visible = items?.filter((n) => prefs[n.type]);
  const unread = visible?.filter((n) => !n.read).length ?? 0;
  const markAllRead = () => setItems((all) => all?.map((n) => ({ ...n, read: true })) ?? null);

  return (
    <Container className="max-w-2xl px-3 py-4 sm:py-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">{t("notif.title")}</h1>
        {tab === "feed" && unread > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            {t("notif.markAllRead")}
          </Button>
        )}
      </div>

      <div role="tablist" className="mb-3 flex gap-2">
        {(["feed", "settings"] as const).map((k) => (
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
            {t(`notif.tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === "feed" ? (
        !visible ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState icon={<BellIcon />} title={t("notif.emptyTitle")} body={t("notif.emptyBody")} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {visible.map((n) => {
              const Icon = ICONS[n.type];
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setItems((all) => all?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null)}
                    className={cn(
                      "flex items-start gap-3 px-3 py-3 hover:bg-primary-soft/40",
                      !n.read && "bg-primary-soft/30"
                    )}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm text-ink", !n.read && "font-semibold")}>
                        {t(`notif.items.${n.titleKey}`, n.vars)}
                      </span>
                      <span className="block text-xs text-ink-muted">{formatRelativeTime(n.createdAt, locale)}</span>
                    </span>
                    {!n.read && (
                      <span aria-label={t("notif.unread")} className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <div className="space-y-4">
          <section className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink">{t("notif.push.title")}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {push === "granted"
                ? t("notif.push.on")
                : push === "denied"
                  ? t("notif.push.denied")
                  : push === "unsupported"
                    ? t("notif.push.unsupported")
                    : t("notif.push.body")}
            </p>
            {push === "default" && (
              <Button className="mt-3" onClick={enablePush}>
                {t("notif.push.enable")}
              </Button>
            )}
          </section>

          <section className="rounded-card border border-border bg-surface">
            <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-ink">{t("notif.prefs")}</h2>
            <ul className="divide-y divide-border">
              {(Object.keys(defaultPrefs) as NotificationType[]).map((k) => (
                <li key={k}>
                  <label className="tap-target flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm text-ink">
                    {t(`notif.types.${k}`)}
                    <input
                      type="checkbox"
                      role="switch"
                      checked={prefs[k]}
                      onChange={() => togglePref(k)}
                      className="h-5 w-5 accent-primary"
                    />
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Container>
  );
}
