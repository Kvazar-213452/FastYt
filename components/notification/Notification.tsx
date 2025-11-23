import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { NotificationType } from '@/lib/notificationService';
import styles from '@/style/notification.module.css';

interface NotificationProps {
  message: string;
  type: NotificationType;
}

const Notification: React.FC<NotificationProps> = ({ message, type }) => {
  const [visible, setVisible] = useState<boolean>(!!message);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!message) return null;

  const getIcon = () => {
    switch (type) {
      case 'successfully':
        return <CheckCircle size={20} />;
      case 'warning':
        return <AlertTriangle size={20} />;
      case 'error':
        return <XCircle size={20} />;
      default:
        return <Info size={20} />;
    }
  };

  const typeClass =
    type === 'warning' ? styles.yellow :
    type === 'successfully' ? styles.green :
    type === 'error' ? styles.red :
    styles.gray;

  return (
    <div className={`${styles.notification} ${typeClass} ${!visible ? styles.hidden : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {getIcon()}
        {message}
      </div>
    </div>
  );
};

export default Notification;