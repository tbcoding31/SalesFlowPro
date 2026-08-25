import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { teamsApi, Team, TeamMember } from '../../services/teamsApi';
import { usersApi } from '../../services/usersApi';
import { User } from '../../types';

export const TeamMembersPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showChangeLeaderModal, setShowChangeLeaderModal] = useState(false);

  // Form states
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newTeamLeaderId, setNewTeamLeaderId] = useState('');
  const [candidateUsers, setCandidateUsers] = useState<User[]>([]);

  // Add member state
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [memberRole, setMemberRole] = useState<'MEMBER' | 'LEADER'>('MEMBER');

  // Search & Filter
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await teamsApi.fetchTeams(tenantId);
      setTeams(data);
      if (data.length > 0) {
        // Refresh currently selected team if still present
        if (selectedTeam) {
          const fresh = data.find(t => t.id === selectedTeam.id);
          if (fresh) {
            const detail = await teamsApi.fetchTeamById(fresh.id);
            setSelectedTeam(detail || fresh);
          } else {
            const detail = await teamsApi.fetchTeamById(data[0].id);
            setSelectedTeam(detail || data[0]);
          }
        } else {
          const detail = await teamsApi.fetchTeamById(data[0].id);
          setSelectedTeam(detail || data[0]);
        }
      } else {
        setSelectedTeam(null);
      }
    } catch (err: any) {
      setError('Unable to load teams from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadCandidates = async () => {
    const users = await usersApi.fetchUsers(tenantId, true);
    setCandidateUsers(users);
  };

  const handleSelectTeam = async (team: Team) => {
    setIsLoading(true);
    const detail = await teamsApi.fetchTeamById(team.id);
    setSelectedTeam(detail || team);
    setIsLoading(false);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const res = await teamsApi.createTeam({
      name: newTeamName.trim(),
      description: newTeamDesc.trim(),
      leaderId: newTeamLeaderId || undefined,
      tenantId
    });

    if (res.success) {
      setShowCreateTeamModal(false);
      setNewTeamName('');
      setNewTeamDesc('');
      setNewTeamLeaderId('');
      await loadData();
    } else {
      if (res.code === 'DUPLICATE_TEAM_NAME') {
        alert('A team with this name already exists in this organization.');
      } else {
        alert(res.error || 'Failed to create team.');
      }
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !selectedCandidateId) return;

    const cand = candidateUsers.find(u => u.id === selectedCandidateId || u.tenantUserId === selectedCandidateId);
    const targetTenantUserId = cand?.tenantUserId || cand?.id;
    if (!targetTenantUserId) return;

    const res = await teamsApi.addMember(selectedTeam.id, targetTenantUserId, memberRole);
    if (res.success) {
      setShowAddMemberModal(false);
      setSelectedCandidateId('');
      setMemberRole('MEMBER');
      await loadData();
    } else {
      alert(res.error || 'Failed to add member to team.');
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!selectedTeam) return;
    if (!window.confirm(`Remove ${member.name} from ${selectedTeam.name}?`)) return;

    const res = await teamsApi.removeMember(selectedTeam.id, member.tenantUserId || member.userId);
    if (res.success) {
      await loadData();
    } else {
      alert(res.error || 'Failed to remove member.');
    }
  };

  const handleChangeLeader = async (leaderUserId: string) => {
    if (!selectedTeam) return;
    const cand = candidateUsers.find(u => u.id === leaderUserId || u.tenantUserId === leaderUserId);
    const targetTenantUserId = cand?.tenantUserId || cand?.id || null;

    const res = await teamsApi.updateTeam(selectedTeam.id, { leaderId: targetTenantUserId });
    if (res.success) {
      setShowChangeLeaderModal(false);
      await loadData();
    } else {
      alert(res.error || 'Failed to change team leader.');
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    if (!window.confirm(`Are you sure you want to delete "${selectedTeam.name}"?`)) return;

    const res = await teamsApi.deleteTeam(selectedTeam.id);
    if (res.success) {
      await loadData();
    } else {
      if (res.code === 'TEAM_HAS_MEMBERS') {
        alert('This team still has active members.\n\nMove or remove all members before deleting the team.');
      } else {
        alert(res.error || 'Failed to delete team.');
      }
    }
  };

  const filteredTeams = useMemo(() => {
    return teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || 
                             (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
                             (t.leaderName || '').toLowerCase().includes(search.toLowerCase()));
  }, [teams, search]);

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#4744e5]/10 text-[#4744e5] text-xs font-bold rounded uppercase">
              Organization
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            Teams & Supervision
          </h1>
          <p className="text-xs text-[#464555] mt-0.5">
            Organize sales members into operational teams for leadership and TEAM-scoped data authorization.
          </p>
        </div>

        <button 
          onClick={() => {
            loadCandidates();
            setShowCreateTeamModal(true);
          }}
          className="px-4 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">group_add</span>
          <span>+ Create Team</span>
        </button>
      </div>

      {/* Main Grid: Teams List & Team Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Teams Directory */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-sm space-y-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767587] text-[18px]">search</span>
              <input 
                type="text"
                placeholder="Search teams or leaders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-hidden focus:border-[#4744e5]"
              />
            </div>

            <div className="divide-y divide-[#E1E1E1] max-h-[600px] overflow-y-auto">
              {isLoading && teams.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#767587]">Loading teams...</div>
              ) : error ? (
                <div className="py-8 text-center text-xs text-rose-600">
                  {error}
                  <div className="mt-2">
                    <button onClick={loadData} className="px-3 py-1 bg-slate-100 rounded text-[11px] font-bold">Retry</button>
                  </div>
                </div>
              ) : filteredTeams.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <span className="material-symbols-outlined text-3xl text-slate-300">groups</span>
                  <div className="text-xs text-[#767587] font-semibold">No teams yet.</div>
                  <p className="text-[11px] text-[#767587]">Create a team to organize sales members and enable TEAM-scoped supervision.</p>
                </div>
              ) : (
                filteredTeams.map((team) => {
                  const isSelected = selectedTeam?.id === team.id;
                  return (
                    <div
                      key={team.id}
                      onClick={() => handleSelectTeam(team)}
                      className={`p-3.5 cursor-pointer transition-colors rounded-lg my-1 ${
                        isSelected 
                          ? 'bg-[#4744e5]/5 border-l-4 border-[#4744e5]' 
                          : 'hover:bg-[#f9f9f9]'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-xs text-[#1a1c1c] font-['Hanken_Grotesk']">
                          {team.name}
                        </div>
                        <span className="px-2 py-0.5 bg-slate-100 text-[#464555] rounded text-[10px] font-bold">
                          {team.memberCount || 0} members
                        </span>
                      </div>
                      <div className="text-[11px] text-[#767587] mt-1 truncate">
                        Leader: <span className="font-medium text-[#1a1c1c]">{team.leaderName || 'No Leader Assigned'}</span>
                      </div>
                      {team.description && (
                        <p className="text-[10px] text-[#767587] mt-1 line-clamp-1">{team.description}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Team Detail */}
        <div className="lg:col-span-2">
          {selectedTeam ? (
            <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-sm p-6 space-y-6">
              {/* Detail Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#E1E1E1]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                      {selectedTeam.name}
                    </h2>
                    <span className="px-2.5 py-0.5 bg-[#00C875]/10 text-[#008f53] text-[10px] font-bold rounded-full">
                      ACTIVE TEAM
                    </span>
                  </div>
                  <p className="text-xs text-[#767587] mt-1">
                    {selectedTeam.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      loadCandidates();
                      setShowAddMemberModal(true);
                    }}
                    className="px-3 py-1.5 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    <span>Add Member</span>
                  </button>
                  <button
                    onClick={handleDeleteTeam}
                    title="Delete Team"
                    className="p-1.5 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 rounded-lg border border-[#ba1a1a]/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>

              {/* Leadership Card */}
              <div className="bg-[#f9f9f9] border border-[#E1E1E1] rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#4744e5]/10 text-[#4744e5] rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">workspace_premium</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-[#767587]">Team Supervisor / Leader</div>
                    <div className="text-sm font-bold text-[#1a1c1c] flex items-center gap-2">
                      <span>{selectedTeam.leaderName || 'No Leader Assigned'}</span>
                      {selectedTeam.leaderStatus && selectedTeam.leaderStatus !== 'ACTIVE' && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded">
                          {selectedTeam.leaderStatus}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#767587]">{selectedTeam.leaderEmail || 'Assign an active supervisor'}</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    loadCandidates();
                    setShowChangeLeaderModal(true);
                  }}
                  className="px-3 py-1.5 bg-white border border-[#E1E1E1] hover:bg-[#f9f9f9] text-xs font-semibold rounded-lg text-[#1a1c1c] transition-colors"
                >
                  Change Leader
                </button>
              </div>

              {/* Members Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] uppercase tracking-wider">
                    Team Members ({selectedTeam.members?.length || 0})
                  </h3>
                </div>

                <div className="border border-[#E1E1E1] rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs text-[#1a1c1c]">
                    <thead className="bg-[#f9f9f9] text-[#767587] font-bold uppercase border-b border-[#E1E1E1]">
                      <tr>
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Team Role</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E1E1]">
                      {!selectedTeam.members || selectedTeam.members.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-[#767587]">
                            No members assigned to this team yet.
                          </td>
                        </tr>
                      ) : (
                        selectedTeam.members.map((member) => (
                          <tr key={member.id || member.userId} className="hover:bg-[#f9f9f9]">
                            <td className="px-4 py-3">
                              <div className="font-bold">{member.name}</div>
                              <div className="text-[11px] text-[#767587]">{member.email}</div>
                            </td>
                            <td className="px-4 py-3 font-medium text-[#4744e5]">{member.role}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                member.teamRole === 'LEADER' ? 'bg-[#4744e5]/10 text-[#4744e5]' : 'bg-slate-100 text-[#464555]'
                              }`}>
                                {member.teamRole}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                member.status === 'ACTIVE' ? 'bg-[#00C875]/10 text-[#008f53]' : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                              }`}>
                                {member.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleRemoveMember(member)}
                                title="Remove from Team"
                                className="p-1 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 rounded"
                              >
                                <span className="material-symbols-outlined text-[16px]">person_remove</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-sm p-12 text-center space-y-3">
              <span className="material-symbols-outlined text-4xl text-slate-300">group_work</span>
              <h3 className="text-base font-bold text-[#1a1c1c]">No Team Selected</h3>
              <p className="text-xs text-[#767587]">Select a team from the left directory or create a new team to manage members.</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE TEAM MODAL */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-md w-full p-6 space-y-4 font-['Inter',sans-serif]">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Create Operational Team</h2>
              <button onClick={() => setShowCreateTeamModal(false)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jakarta Enterprise Sales"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-hidden focus:border-[#4744e5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Operational purpose or territory..."
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-hidden focus:border-[#4744e5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Team Leader (Optional)</label>
                <select
                  value={newTeamLeaderId}
                  onChange={(e) => setNewTeamLeaderId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-hidden focus:border-[#4744e5]"
                >
                  <option value="">-- No Leader (Assign Later) --</option>
                  {candidateUsers.map((cand) => (
                    <option key={cand.id} value={cand.tenantUserId || cand.id}>
                      {cand.name} ({cand.roleName || cand.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] text-[#1a1c1c] rounded-lg text-xs font-semibold hover:bg-[#f9f9f9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white rounded-lg text-xs font-bold transition-all"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {showAddMemberModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-md w-full p-6 space-y-4 font-['Inter',sans-serif]">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Add Member to {selectedTeam.name}
              </h2>
              <button onClick={() => setShowAddMemberModal(false)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Select Active User *</label>
                <select
                  required
                  value={selectedCandidateId}
                  onChange={(e) => setSelectedCandidateId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-hidden focus:border-[#4744e5]"
                >
                  <option value="">-- Select Organization Member --</option>
                  {candidateUsers.map((cand) => (
                    <option key={cand.id} value={cand.tenantUserId || cand.id}>
                      {cand.name} ({cand.roleName || cand.role}) - {cand.email}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#767587] mt-1">
                  * Note: Each membership belongs to at most one active team. Assigning a member to this team will update their active team assignment.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Team Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-hidden focus:border-[#4744e5]"
                >
                  <option value="MEMBER">Team Member</option>
                  <option value="LEADER">Team Leader / Supervisor</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] text-[#1a1c1c] rounded-lg text-xs font-semibold hover:bg-[#f9f9f9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedCandidateId}
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#2c24ce] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all"
                >
                  Assign to Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE LEADER MODAL */}
      {showChangeLeaderModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-md w-full p-6 space-y-4 font-['Inter',sans-serif]">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Change Leader for {selectedTeam.name}
              </h2>
              <button onClick={() => setShowChangeLeaderModal(false)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Select New Supervisor</label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleChangeLeader(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-hidden focus:border-[#4744e5]"
                >
                  <option value="">-- Select Active Supervisor --</option>
                  {candidateUsers.map((cand) => (
                    <option key={cand.id} value={cand.tenantUserId || cand.id}>
                      {cand.name} ({cand.roleName || cand.role}) - {cand.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowChangeLeaderModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] text-[#1a1c1c] rounded-lg text-xs font-semibold hover:bg-[#f9f9f9]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
