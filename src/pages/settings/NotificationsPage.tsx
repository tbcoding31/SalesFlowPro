import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const { user } = useAuth();

  const fetchNotifs = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` }
      });
      if (res.ok) {
        fetchNotifs();
      }
    } catch(e) {
      console.error(e);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` }
      });
      if (res.ok) {
        fetchNotifs();
      }
    } catch(e) {
      console.error(e);
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZone: 'Asia/Jakarta'
      }).format(new Date(iso)).replace('Sept', 'Sep') + ' WIB';
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif]">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Notifications</h1>
          <p className="text-sm text-[#464555] mt-1">View your latest notifications and alerts.</p>
        </div>
        <button onClick={markAllAsRead} className="px-4 py-2 bg-white border border-[#E1E1E1] hover:bg-[#f3f3f3] text-[#1a1c1c] text-sm font-bold rounded-lg transition-all">
          Mark all as read
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-sm overflow-hidden">
        <ul className="divide-y divide-[#E1E1E1]">
          {notifications.map((notif) => (
            <li key={notif.id} onClick={() => !notif.isRead && markAsRead(notif.id)} className={`p-4 flex gap-4 cursor-pointer ${notif.isRead ? 'bg-white' : 'bg-[#f4f7fc]'}`}>
              <div className="mt-1">
                <span className={`material-symbols-outlined text-[24px] ${notif.isRead ? 'text-[#a1a1aa]' : 'text-[#4744e5]'}`}>
                  {notif.isRead ? 'notifications' : 'notifications_active'}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className={`text-sm font-bold ${notif.isRead ? 'text-[#1a1c1c]' : 'text-[#4744e5]'}`}>{notif.title}</h3>
                  <span className="text-xs text-[#767587] whitespace-nowrap ml-4">{formatDateTime(notif.createdAt)}</span>
                </div>
                <p className="text-sm text-[#464555] mt-1">{notif.message}</p>
              </div>
            </li>
          ))}
          {notifications.length === 0 && (
            <li className="p-8 text-center text-sm text-gray-500">No notifications found.</li>
          )}
        </ul>
      </div>
    </div>
  );
};
