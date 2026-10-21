import type { AppNotification } from "./types";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** Mock backend seam — swap for `GET /notifications` (+ web push subscription) later. */
export async function getNotifications(): Promise<AppNotification[]> {
  return [
    { id: "n1", type: "offer", titleKey: "offerReceived", vars: { name: "Abebe", amount: "40,000" }, href: "/messages/c1", read: false, createdAt: ago(30) },
    { id: "n2", type: "message", titleKey: "newMessage", vars: { name: "Hana" }, href: "/messages/c2", read: false, createdAt: ago(95) },
    { id: "n3", type: "meetup", titleKey: "meetupProposed", vars: { name: "Dawit", place: "Edna Mall" }, href: "/messages/c3", read: false, createdAt: ago(240) },
    { id: "n4", type: "priceDrop", titleKey: "priceDrop", vars: { title: "3-Seat Fabric Sofa", amount: "11,000" }, href: "/saved", read: true, createdAt: ago(1500) },
    { id: "n5", type: "moderation", titleKey: "listingApproved", vars: { title: "Samsung Galaxy A54" }, href: "/dashboard/listings", read: true, createdAt: ago(3000) },
  ];
}
