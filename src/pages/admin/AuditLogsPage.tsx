import React, { useState } from 'react';

export const AuditLogsPage: React.FC = () => {
  const [logs] = useState([
    { id: 1, action: 'User Login', user: 'ahmad@salesflow.pro', role: 'Super Admin', ip: '192.168.1.100', date: '2026-08-13 14:32:11' },
    { id: 2, action: 'Created Tenant', user: 'ahmad@salesflow.pro', role: 'Super Admin', ip: '192.168.1.100', date: '2026-08-13 11:20:05' },
    { id: 3, action: 'Updated Settings', user: 'system', role: 'System', ip: 'localhost', date: '2026-08-12 23:00:00' },
    { id: 4, action: 'Deleted User', user: 'ahmad@salesflow.pro', role: 'Super Admin', ip: '192.168.1.100', date: '2026-08-12 16:45:22' },
    { id: 5, action: 'User Logout', user: 'ahmad@salesflow.pro', role: 'Super Admin', ip: '192.168.1.100', date: '2026-08-12 16:50:11' },
  ]);

  return (
    <div className="space-y-6 font-['Inter',sans-serif]">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Audit Logs</h1>
          <p className="text-sm text-[#464555] mt-1">Review system activities and user actions.</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Search logs..." 
            className="px-3 py-2 border border-[#E1E1E1] rounded-lg text-sm w-64 focus:outline-none focus:border-[#4744e5]"
          />
          <button className="px-4 py-2 bg-white border border-[#E1E1E1] hover:bg-[#f3f3f3] text-[#1a1c1c] text-sm font-bold rounded-lg transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Filter
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#f8f9fa] border-b border-[#E1E1E1]">
              <tr>
                <th className="px-6 py-4 font-bold text-[#464555]">Action</th>
                <th className="px-6 py-4 font-bold text-[#464555]">User</th>
                <th className="px-6 py-4 font-bold text-[#464555]">Role</th>
                <th className="px-6 py-4 font-bold text-[#464555]">IP Address</th>
                <th className="px-6 py-4 font-bold text-[#464555]">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E1E1]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#f8f9fa] transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-[#1a1c1c]">{log.action}</span>
                  </td>
                  <td className="px-6 py-4 text-[#464555]">{log.user}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-[#e1dfff] text-[#09006b] rounded-md text-xs font-bold">
                      {log.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#464555] font-mono text-xs">{log.ip}</td>
                  <td className="px-6 py-4 text-[#767587] text-xs">{log.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
