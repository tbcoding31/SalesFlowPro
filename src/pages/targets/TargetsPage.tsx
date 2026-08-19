import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { SalesTarget, User } from '../../types';

export const TargetsPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [period, setPeriod] = useState<string>('Q3 2026');
  const [targets, setTargets] = useState<SalesTarget[]>(DataService.getTargets(tenantId));
  const [tenantUsers] = useState<User[]>(DataService.getUsers(tenantId));
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [selectedUserId, setSelectedUserId] = useState(tenantUsers[0]?.id || 'USR-005');
  const [targetRevenue, setTargetRevenue] = useState(10000000000);
  const [targetVisits, setTargetVisits] = useState(40);

  const totalTargetRev = targets.reduce((acc, t) => acc + (t.targetRevenue || t.targetAmount || 0), 0);
  const totalAchievedRev = targets.reduce((acc, t) => acc + (t.achievedRevenue || t.actualAmount || 0), 0);
  const overallRate = totalTargetRev > 0 ? Math.round((totalAchievedRev / totalTargetRev) * 100) : 0;

  const handleSaveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const usr = tenantUsers.find((u) => u.id === selectedUserId);
    const newTarget: SalesTarget = {
      id: `TRG-${Date.now().toString().slice(-4)}`,
      tenantId,
      repId: selectedUserId,
      repName: usr?.name || 'Sales Rep',
      repAvatar: usr?.avatarUrl,
      period,
      targetRevenue,
      achievedRevenue: 0,
      targetVisits,
      achievedVisits: 0,
    };

    DataService.saveTarget(newTarget);
    setTargets(DataService.getTargets(tenantId));
    setShowModal(false);
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#4744e5]/10 text-[#4744e5] text-xs font-bold rounded uppercase">
              Sales Quotas
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            Sales Target Quotas & Performance Benchmarks
          </h1>
          <p className="text-xs text-[#464555] mt-0.5">
            Set quarterly revenue targets, visit frequencies, and monitor achievement progress.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-white border border-[#E1E1E1] text-[#1a1c1c] text-xs font-bold rounded-lg px-3 py-2 focus:outline-none"
          >
            <option value="Q1 2026">Q1 2026 (Jan - Mar)</option>
            <option value="Q2 2026">Q2 2026 (Apr - Jun)</option>
            <option value="Q3 2026">Q3 2026 (Jul - Sep)</option>
            <option value="Q4 2026">Q4 2026 (Oct - Dec)</option>
          </select>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 font-['Hanken_Grotesk'] shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add_chart</span>
            <span>Set Sales Quota</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Card */}
      <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm space-y-4">
        <div className="flex justify-between items-baseline">
          <div>
            <span className="text-xs font-bold text-[#464555] font-['Hanken_Grotesk'] uppercase tracking-wider block">
              Organization Target Achievement ({period})
            </span>
            <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
              Rp {(totalAchievedRev / 1000000000).toFixed(1)}B / Rp {(totalTargetRev / 1000000000).toFixed(1)}B IDR
            </div>
          </div>
          <span className="text-3xl font-extrabold text-[#4744e5] font-['Hanken_Grotesk']">
            {overallRate}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#f3f3f3] h-3 rounded-full overflow-hidden border border-[#E1E1E1]">
          <div
            className="bg-[#4744e5] h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(overallRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Target Breakdown Table */}
      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-sm overflow-hidden p-6 space-y-4">
        <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] border-b border-[#E1E1E1] pb-3">
          Sales Representative Target Quota Table
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1a1c1c]">
            <thead className="bg-[#f9f9f9] text-[#464555] font-bold uppercase border-b border-[#E1E1E1]">
              <tr>
                <th className="px-6 py-3.5">Sales Officer</th>
                <th className="px-6 py-3.5">Target Revenue (IDR)</th>
                <th className="px-6 py-3.5">Achieved Revenue (IDR)</th>
                <th className="px-6 py-3.5">Visits Target vs Actual</th>
                <th className="px-6 py-3.5">Quota Achievement Rate</th>
                <th className="px-6 py-3.5 text-right">Commission Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E1E1]">
              {targets.map((t) => {
                const trgRev = t.targetRevenue || t.targetAmount || 1;
                const achRev = t.achievedRevenue || t.actualAmount || 0;
                const rate = Math.round((achRev / trgRev) * 100);
                const name = t.repName || t.userName || 'Sales Officer';
                const achVisits = t.achievedVisits || t.actualVisits || 0;
                return (
                  <tr key={t.id} className="hover:bg-[#f9f9f9]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={t.repAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
                          alt={name}
                          className="w-7 h-7 rounded-full object-cover border border-[#E1E1E1]"
                        />
                        <span className="font-bold text-sm text-[#1a1c1c]">{name}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono font-bold text-[#1a1c1c]">
                      Rp {(trgRev / 1000000000).toFixed(1)}B
                    </td>

                    <td className="px-6 py-4 font-mono font-bold text-[#008f53]">
                      Rp {(achRev / 1000000000).toFixed(1)}B
                    </td>

                    <td className="px-6 py-4 font-semibold text-[#464555]">
                      {achVisits} / {t.targetVisits} Visits
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[#4744e5] text-sm">{rate}%</span>
                        <div className="w-20 bg-[#f3f3f3] h-2 rounded-full overflow-hidden border border-[#E1E1E1]">
                          <div
                            className="bg-[#4744e5] h-full"
                            style={{ width: `${Math.min(rate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rate >= 100
                            ? 'bg-[#00C875]/10 text-[#008f53]'
                            : rate >= 75
                            ? 'bg-[#6161ff]/10 text-[#6161ff]'
                            : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                        }`}
                      >
                        {rate >= 100 ? 'Bonus Tier 1' : rate >= 75 ? 'Standard Tier' : 'Needs Review'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE TARGET MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Set Sales Officer Quota ({period})
              </h2>
              <button onClick={() => setShowModal(false)} className="text-[#767587]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Sales Representative</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs bg-white font-bold"
                >
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.roleName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Quarterly Revenue Target (IDR)</label>
                <input
                  type="number"
                  value={targetRevenue}
                  onChange={(e) => setTargetRevenue(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Visits Quota (Count)</label>
                <input
                  type="number"
                  value={targetVisits}
                  onChange={(e) => setTargetVisits(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] text-white rounded text-xs font-bold hover:bg-[#2c24ce]"
                >
                  Save Quota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
