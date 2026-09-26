export type NotificationType = "message" | "offer" | "priceDrop" | "moderation" | "meetup";

export interface AppNotification {
  id: string;
  type: NotificationType;
  /** i18n key suffix under `notif.items.*` */
  titleKey: string;
  vars?: Record<string, string | number>;
  href: string;
  read: boolean;
  createdAt: string;
}

export type NotificationPrefs = Record<NotificationType, boolean>;

export const defaultPrefs: NotificationPrefs = {
  message: true,
  offer: true,
  priceDrop: true,
  moderation: true,
  meetup: true,
};
