"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ChevronLeftIcon, MapPinIcon, ShieldIcon, StarIcon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLanguage } from "@/il8n/LanguageProvider";
import { cn, formatETB } from "@/lib/utils";
import { getConversation } from "../queries";
import type { ChatMessage, Conversation } from "../types";

import { MeetupSheet } from "./MeetupSheet";
import { OfferSheet } from "./OfferSheet";
import { ReportSheet } from "./ReportSheet";
import { ReviewSheet } from "./ReviewSheet";

/** Quick replies (FR-T1) differ by role: buyers ask, sellers answer. */
const QUICK = {
  buying: ["available", "lastPrice", "whereMeet", "canMeet"],
  selling: ["yesAvailable", "priceFirm", "comeSee", "sold"],
} as const;

export function Thread({ id }: { id: string }) {
  const { t, locale } = useLanguage();
  const [convo, setConvo] = useState<Conversation | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLLIElement>(null);
  const [meetupOpen, setMeetupOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const wantsOffer = useSearchParams().get("offer") === "1";
  const [sheet, setSheet] = useState<{ mode: "offer" | "counter"; replaces?: string; lastCents?: number } | null>(null);

  useEffect(() => {
    getConversation(id).then((c) => {
      setConvo(c);
      setMessages(c?.messages ?? []);
      if (c?.role === "buying" && wantsOffer) setSheet({ mode: "offer" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = (body: string) => {
    const text = body.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { id: `l${m.length}`, mine: true, kind: "text", body: text, sentAt: new Date().toISOString() },
    ]);
    setDraft("");
  };

  const proposeMeetup = ({ place, when }: { place: string; when: string }) =>
    setMessages((m) => [
      ...m,
      { id: `u${m.length}`, mine: true, kind: "meetup", body: place, when, meetupStatus: "proposed", sentAt: new Date().toISOString() },
    ]);

  const acceptMeetup = (msgId: string) =>
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, meetupStatus: "accepted" as const } : x)));

  const dealDone = messages.some((x) => x.kind === "offer" && x.offerStatus === "accepted");

  /** Sends a new offer, or a counter that supersedes the pending one. */
  const sendOffer = (cents: number) =>
    setMessages((m) => {
      const target = sheet?.replaces;
      const prev = m.find((x) => x.id === target);
      const next = m.map((x) => (x.id === target ? { ...x, offerStatus: "countered" as const } : x));
      next.push({
        id: `o${m.length}`,
        mine: true,
        kind: "offer",
        offerCents: cents,
        offerStatus: "pending",
        previousCents: prev?.offerCents,
        sentAt: new Date().toISOString(),
      });
      return next;
    });

  const respond = (msgId: string, status: "accepted" | "declined") =>
    setMessages((m) => {
      const next = m.map((x) => (x.id === msgId ? { ...x, offerStatus: status } : x));
      if (status === "accepted") {
        next.push({
          id: `s${m.length}`,
          mine: false,
          kind: "system",
          body: t("chat.reserved"),
          sentAt: new Date().toISOString(),
        });
      }
      return next;
    });

  if (convo === undefined) {
    return (
      <Container className="max-w-2xl space-y-3 px-3 py-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="ml-auto h-10 w-1/2" />
      </Container>
    );
  }
  if (convo === null) {
    return (
      <Container className="max-w-2xl px-3 py-10">
        <EmptyState
          title={t("chat.notFound")}
          action={
            <Link href="/messages" className="text-sm font-medium text-primary">
              {t("chat.title")}
            </Link>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="flex max-w-2xl flex-col px-0 sm:px-4 sm:py-6 lg:max-w-3xl">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2">
        <Link href="/messages" aria-label={t("chat.back")} className="tap-target flex items-center">
          <ChevronLeftIcon className="h-5 w-5" />
        </Link>
        <Avatar name={convo.peerName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{convo.peerName}</p>
          <p className="truncate text-xs text-ink-muted">
            {convo.listingTitle} · {formatETB(convo.listingPriceCents, locale)}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMeetupOpen(true)} aria-label={t("meetup.title")}>
          <MapPinIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{t("meetup.short")}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
          {t("report.short")}
        </Button>
      </div>
      {notice && (
        <p role="status" className="mx-3 mt-3 rounded-control bg-success/10 px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      )}

      <p className="mx-3 mt-3 flex items-start gap-2 rounded-control bg-primary-soft px-3 py-2 text-xs text-ink">
        <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        {t("chat.safety")}
      </p>

      <div className="mx-3 mt-3 grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" className="whitespace-normal px-1 text-xs" onClick={() => setMeetupOpen(true)}>
          <MapPinIcon className="h-4 w-4" />
          {t("meetup.short")}
        </Button>
        <Button variant="outline" size="sm" className="whitespace-normal px-1 text-xs" disabled={reviewed} onClick={() => setReviewOpen(true)}>
          <StarIcon className="h-4 w-4" />
          {t("review.short")}
        </Button>
        <Button variant="outline" size="sm" className="whitespace-normal px-1 text-xs" onClick={() => setReportOpen(true)}>
          <ShieldIcon className="h-4 w-4" />
          {t("report.short")}
        </Button>
      </div>

      <ul className="flex min-h-[45dvh] flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 sm:max-h-[60dvh] sm:px-5" aria-live="polite">
        {messages.map((m) =>
          m.kind === "system" ? (
            <li key={m.id} className="self-center rounded-full bg-ink/5 px-3 py-1 text-xs text-ink-muted">
              {m.body}
            </li>
          ) : m.kind === "meetup" ? (
            <li
              key={m.id}
              className={cn(
                "w-[85%] rounded-card border border-primary/30 bg-surface p-3 sm:w-80",
                m.mine ? "self-end" : "self-start"
              )}
            >
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <MapPinIcon className="h-4 w-4" />
                {t("meetup.proposal")}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">{m.body}</p>
              <p className="mb-2 text-xs text-ink-muted">{m.when ? new Date(m.when).toLocaleString(locale === "am" ? "am-ET" : "en") : ""}</p>
              {m.meetupStatus === "proposed" && !m.mine ? (
                <Button size="sm" onClick={() => acceptMeetup(m.id)}>
                  {t("chat.accept")}
                </Button>
              ) : (
                <span className="text-xs font-semibold text-primary">
                  {t(m.meetupStatus === "accepted" ? "meetup.accepted" : "meetup.waiting")}
                </span>
              )}
            </li>
          ) : m.kind === "offer" ? (
            <li
              key={m.id}
              className={cn(
                "w-[85%] rounded-card border sm:w-80 border-border bg-surface p-3",
                m.mine ? "self-end" : "self-start"
              )}
            >
              <p className="text-xs font-medium text-ink-muted">{t("chat.offer")}</p>
              <p className="text-lg font-bold text-ink">{formatETB(m.offerCents ?? 0, locale)}</p>
              {m.previousCents !== undefined && (
                <p className="text-xs text-ink-muted">
                  {t("chat.wasOffer", { amount: formatETB(m.previousCents, locale) })}
                </p>
              )}
              <p className="mb-2 text-xs text-ink-muted">{t("chat.noPayment")}</p>
              {m.offerStatus === "pending" && !m.mine ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => respond(m.id, "accepted")}>
                    {t("chat.accept")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => respond(m.id, "declined")}>
                    {t("chat.decline")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSheet({ mode: "counter", replaces: m.id, lastCents: m.offerCents })}
                  >
                    {t("chat.counter")}
                  </Button>
                </div>
              ) : (
                <span className="text-xs font-semibold text-primary">
                  {t(`chat.status.${m.offerStatus ?? "pending"}`)}
                </span>
              )}
            </li>
          ) : (
            <li
              key={m.id}
              className={cn(
                "max-w-[80%] rounded-card px-3 py-2 text-sm sm:max-w-[65%] sm:text-base",
                m.mine ? "self-end bg-primary text-white" : "self-start bg-ink/6 text-ink"
              )}
            >
              {m.body}
            </li>
          )
        )}
        {dealDone && !reviewed && (
          <li className="w-full self-center rounded-card border border-border bg-surface p-3 text-center sm:w-80">
            <StarIcon className="mx-auto h-6 w-6 text-warning" />
            <p className="mt-1 text-sm font-semibold text-ink">{t("review.prompt", { name: convo.peerName })}</p>
            <Button size="sm" className="mt-2" onClick={() => setReviewOpen(true)}>
              {t("review.cta")}
            </Button>
          </li>
        )}
        {dealDone && reviewed && (
          <li className="self-center rounded-full bg-ink/5 px-3 py-1 text-xs text-ink-muted">{t("review.thanks")}</li>
        )}
        <li ref={endRef} aria-hidden />
      </ul>

      <div className="sticky bottom-0 border-t border-border bg-surface px-3 py-2">
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {convo.role === "buying" && (
            <button
              onClick={() => setSheet({ mode: "offer" })}
              className="tap-target shrink-0 rounded-full bg-primary px-3 text-xs font-medium text-white"
            >
              {t("chat.makeOffer")}
            </button>
          )}
          {QUICK[convo.role].map((k) => (
            <button
              key={k}
              onClick={() => send(t(`chat.quick.${k}`))}
              className="tap-target shrink-0 rounded-full border border-border px-3 text-xs text-ink hover:bg-primary-soft"
            >
              {t(`chat.quick.${k}`)}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
            className="h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button type="submit" disabled={!draft.trim()}>
            {t("chat.send")}
          </Button>
        </form>
      </div>
      <MeetupSheet open={meetupOpen} onOpenChange={setMeetupOpen} onSubmit={proposeMeetup} />
      <ReportSheet open={reportOpen} onOpenChange={setReportOpen} defaultTarget="user" />
      <ReviewSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        peerName={convo.peerName}
        onSubmit={() => {
          setReviewed(true);
          setNotice(t("review.thanks"));
        }}
      />
      <OfferSheet
        key={`${sheet?.mode}-${sheet?.replaces}`}
        open={sheet !== null}
        onOpenChange={(o) => !o && setSheet(null)}
        mode={sheet?.mode ?? "offer"}
        listPriceCents={convo.listingPriceCents}
        lastOfferCents={sheet?.lastCents}
        onSubmit={sendOffer}
      />
    </Container>
  );
}
