"use server";

import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRow,
} from "@/server/notifications/service";

export async function getNotificationsAction(): Promise<NotificationRow[]> {
  return listMyNotifications(20);
}

export async function markNotificationReadAction(id: string): Promise<void> {
  await markNotificationRead(id);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  await markAllNotificationsRead();
}
