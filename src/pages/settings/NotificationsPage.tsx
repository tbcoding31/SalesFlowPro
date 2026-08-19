import React, { useState } from 'react';

export const NotificationsPage: React.FC = () => {
  const [notifications] = useState([
    { id: 1, title: 'New task assigned', message: 'You have been assigned to task #1024.', date: '2026-08-13 10:00', read: false },
    { id: 2, title: 'System update', message: 'System maintenance scheduled for tonight at 2 AM.', date: '2026-08-12 15:30', read: true },
    { id: 3, title: 'New lead generated', message: 'A new lead has been assigned to your queue.', date: '2026-08-11 09:15', read: true },
  ]);

  return (
    <div className="space-y-6 font-['Inter',sans-serif]">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Notifications</h1>
          <p className="text-sm text-[#464555] mt-1">View your latest notifications and alerts.</p>
        </div>
        <button className="px-4 py-2 bg-white border border-[#E1E1E1] hover:bg-[#f3f3f3] text-[#1a1c1c] text-sm font-bold rounded-lg transition-all">
          Mark all as read
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-sm overflow-hidden">
        <ul className="divide-y divide-[#E1E1E1]">
          {notifications.map((notif) => (
            <li key={notif.id} className={`p-4 flex gap-4 ${notif.read ? 'bg-white' : 'bg-[#f4f7fc]'}`}>
              <div className="mt-1">
                <span className={`material-symbols-outlined text-[24px] ${notif.read ? 'text-[#a1a1aa]' : 'text-[#4744e5]'}`}>
                  {notif.read ? 'notifications' : 'notifications_active'}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className={`text-sm font-bold ${notif.read ? 'text-[#1a1c1c]' : 'text-[#4744e5]'}`}>{notif.title}</h3>
                  <span className="text-xs text-[#767587] whitespace-nowrap ml-4">{notif.date}</span>
                </div>
                <p className="text-sm text-[#464555] mt-1">{notif.message}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
