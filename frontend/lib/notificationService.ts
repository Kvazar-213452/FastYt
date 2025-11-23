export type NotificationType = 'warning' | 'successfully' | 'error' | 'normal';

type NotificationCallback = (message: string, type: NotificationType) => void;

let notifyCallback: NotificationCallback | null = null;

export function showNotification(message: string, type: NotificationType = 'normal') {
  notifyCallback?.(message, type);
}

export function setNotificationCallback(cb: NotificationCallback) {
  notifyCallback = cb;
}