import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';

export const AuditLogsPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id ;

  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const loadData = async (page = currentPage) => {
    setIsLoading(true);
    try {
      const res = await crmApi.fetchAuditLogs({
        page,
        pageSize,
        search: searchQuery || undefined,
        tenantId
      });
      setLogs(res.data || []);
      setTotalItems(res.pagination?.totalItems || 0);
      setTotalPages(res.pagination?.totalPages || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(currentPage);
  }, [tenantId, currentPage, searchQuery]);

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
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search logs..." 
            className="px-3 py-2 border border-[#E1E1E1] rounded-lg text-sm w-64 focus:outline-none focus:border-[#4744e5]"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#f8f9fa] border-b border-[#E1E1E1]">
              <tr>
                <th className="px-6 py-4 font-bold text-[#464555]">Action</th>
                <th className="px-6 py-4 font-bold text-[#464555]">User ID / Actor</th>
                <th className="px-6 py-4 font-bold text-[#464555]">IP Address</th>
                <th className="px-6 py-4 font-bold text-[#464555]">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E1E1]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[#767587]">
                    {isLoading ? 'Loading logs...' : 'No audit logs recorded'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#f8f9fa] transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-[#1a1c1c]">{log.action || log.title}</span>
                    </td>
                    <td className="px-6 py-4 text-[#464555]">{log.userId || log.user || 'System'}</td>
                    <td className="px-6 py-4 text-[#464555] font-mono text-xs">{log.ipAddress || log.ip || '-'}</td>
                    <td className="px-6 py-4 text-[#767587] text-xs">{log.createdAt || log.date || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-4 bg-white border-t border-[#E1E1E1] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#767587]">
          <div>
            Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || totalPages === 0}
              className="w-8 h-8 flex items-center justify-center text-[#767587] hover:bg-[#f3f3f3] rounded disabled:opacity-30 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center cursor-pointer ${
                  currentPage === p ? 'bg-[#4744e5] text-white shadow-2xs' : 'text-[#1a1c1c] hover:bg-[#f3f3f3]'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="w-8 h-8 flex items-center justify-center text-[#767587] hover:bg-[#f3f3f3] rounded disabled:opacity-30 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
