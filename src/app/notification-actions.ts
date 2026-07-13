"use server";

import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteMyNotification,
  clearMyNotifications,
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

export async function deleteNotificationAction(id: string): Promise<void> {
  await deleteMyNotification(id);
}

export async function clearNotificationsAction(): Promise<void> {
  await clearMyNotifications();
}
