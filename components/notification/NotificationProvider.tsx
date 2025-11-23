"use client";

import { useState, useEffect } from 'react';
import Notification from './Notification';
import { setNotificationCallback } from '@/lib/notificationService';
import type { NotificationType } from '@/lib/notificationService';

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState({ message: '', type: 'normal' as NotificationType });

  useEffect(() => {
    setNotificationCallback((msg: string, type: NotificationType) => {
      setNotification({ message: '', type: type });
      setTimeout(() => setNotification({ message: msg, type }), 10);
    });
  }, []);

  return (
    <>
      <Notification message={notification.message} type={notification.type} />
      {children}
    </>
  );
}
