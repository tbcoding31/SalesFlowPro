import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';
import { usersApi } from '../../services/usersApi';
import { Task, Visit, Project, Activity } from '../../types';
import { Avatar } from '../../components/common/Avatar';
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import { ChangePasswordModal } from '../../components/profile/ChangePasswordModal';

export const UserProfilePage: React.FC = () => {
  const { currentUser, updateCurrentUser } = useAuth();
  const tenantId = currentUser?.tenantId;

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myVisits, setMyVisits] = useState<Visit[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);

  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Full profile details
  const [profileData, setProfileData] = useState<any>(currentUser);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load latest authoritative profile from backend
  useEffect(() => {
    usersApi.fetchMyProfile().then((res) => {
      if (res.success && res.profile) {
        setProfileData(res.profile);
        updateCurrentUser(res.profile);
      }
    });
  }, []);

  // Sync profileData when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setProfileData((prev: any) => ({
        ...prev,
        ...currentUser
      }));
    }
  }, [currentUser]);

  // Load operational metrics
  useEffect(() => {
    Promise.all([
      crmApi.fetchCollection<Task>('tasks', tenantId),
      crmApi.fetchCollection<Visit>('visits', tenantId),
      crmApi.fetchCollection<Project>('projects', tenantId),
      crmApi.fetchCollection<Activity>('activities', tenantId)
    ]).then(([tList, vList, pList, aList]) => {
      setMyTasks(tList.filter(t => t.picId === currentUser?.id && t.status !== 'COMPLETED'));
      setMyVisits(vList.filter(v => v.picId === currentUser?.id));
      setMyProjects(pList.filter(p => p.picId === currentUser?.id && p.stage !== 'WON' && p.stage !== 'LOST'));
      setMyActivities(aList.filter(a => a.userId === currentUser?.id));
    }).catch((err) => {
      console.warn('Failed to load profile metrics:', err);
    });
  }, [tenantId, currentUser?.id]);

  // Handle avatar file selection
  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file triggers onChange
    e.target.value = '';

    // Validate client-side
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setNotification({
        type: 'error',
        message: 'Invalid file type. Please choose a JPEG, PNG, or WebP image.'
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setNotification({
        type: 'error',
        message: 'Avatar image must be smaller than 2 MB.'
      });
      return;
    }

    setIsUploadingAvatar(true);
    setNotification(null);

    try {
      const res = await usersApi.uploadAvatar(file);
      if (!res.success) {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to upload avatar image.'
        });
        setIsUploadingAvatar(false);
        return;
      }

      const newAvatarUrl = res.avatarUrl;
      setProfileData((prev: any) => ({
        ...prev,
        avatar: newAvatarUrl,
        avatarUrl: newAvatarUrl
      }));

      // Immediately sync with context across whole app
      updateCurrentUser({
        avatar: newAvatarUrl,
        avatarUrl: newAvatarUrl
      });

      setNotification({
        type: 'success',
        message: 'Profile photo updated successfully!'
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Error occurred while uploading avatar.'
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleProfileUpdated = (updated: any) => {
    setProfileData((prev: any) => ({
      ...prev,
      ...updated
    }));
    updateCurrentUser(updated);
    setNotification({
      type: 'success',
      message: 'Profile updated successfully!'
    });
  };

  const handlePasswordChanged = (changedAt: string) => {
    setProfileData((prev: any) => ({
      ...prev,
      passwordChangedAt: changedAt
    }));
    updateCurrentUser({
      passwordChangedAt: changedAt
    });
    setNotification({
      type: 'success',
      message: 'Password changed successfully!'
    });
  };

  const stats = [
    { label: 'Active Tasks', value: myTasks.length.toString(), icon: 'assignment', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Visits This Month', value: myVisits.length.toString(), icon: 'map', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Open Projects', value: myProjects.length.toString(), icon: 'monitoring', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'System Logs', value: myActivities.length.toString(), icon: 'history', color: 'text-purple-600', bg: 'bg-purple-50' }
  ];

  const activities = myActivities.slice(0, 4).map(act => ({
    id: act.id,
    action: `${act.type} ${act.subject}`,
    time: act.occurredAt?.substring(0, 10) || 'Recent',
    icon: 'history',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50'
  }));

  if (activities.length === 0) {
    activities.push({ id: '1', action: 'Logged in to system', time: 'Today', icon: 'login', color: 'text-slate-600', bg: 'bg-slate-50' } as any);
  }

  const displayName = profileData?.name || currentUser?.name || 'User';
  const displayEmail = profileData?.email || currentUser?.email || '-';
  const displayPhone = profileData?.phone || currentUser?.phone || 'Not set';
  const displayLocation = profileData?.location || currentUser?.location || 'Jakarta, Indonesia';
  const displayTimezone = profileData?.timezone || currentUser?.timezone || 'GMT+7 (WIB)';
  const displayRole = currentUser?.roleName || currentUser?.role || 'Member';
  const displayDepartment = profileData?.department || currentUser?.department || 'Sales Department';

  const nameParts = displayName.trim().split(/\s+/);
  const firstName = nameParts[0] || '-';
  const lastName = nameParts.slice(1).join(' ') || '-';

  const formatPasswordDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Never changed';
    try {
      const d = new Date(dateStr);
      return `Last changed ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } catch {
      return 'Recently changed';
    }
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-2.5 text-sm font-medium animate-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {notification.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
            Profile
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Manage your personal information, profile photo, and account security.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Profile Card & Stats */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Profile Header Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
            
            {/* Avatar with Upload Button */}
            <div className="relative mb-4">
              <Avatar
                src={profileData?.avatarUrl || profileData?.avatar || currentUser?.avatarUrl}
                name={displayName}
                userId={currentUser?.id}
                size="xl"
                className="w-24 h-24 shadow-md border-4 border-white"
              />

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarFileSelected}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                title="Change profile photo"
                className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isUploadingAvatar ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                )}
              </button>
            </div>

            <h2 className="text-xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">
              {displayName}
            </h2>
            <div className="text-sm font-bold text-indigo-600 mt-1">{displayRole}</div>
            <div className="text-xs font-medium text-slate-500 mt-1">{displayDepartment}</div>
            
            <div className="w-full h-px bg-slate-100 my-5"></div>
            
            <div className="w-full flex flex-col gap-3 text-left">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">mail</span>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</div>
                  <div className="font-medium text-slate-700 break-all">{displayEmail}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">phone</span>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</div>
                  <div className="font-medium text-slate-700">{displayPhone}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-28">
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-full ${stat.bg} flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-[18px] ${stat.color}`}>{stat.icon}</span>
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{stat.value}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Right Column: Information & Activity */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Personal Information */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">Personal Information</h2>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(true)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span>
                Edit Profile
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">First Name</label>
                <div className="text-sm font-semibold text-slate-900">{firstName}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Name</label>
                <div className="text-sm font-semibold text-slate-900">{lastName}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                <div className="text-sm font-semibold text-slate-900">{displayEmail}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                <div className="text-sm font-semibold text-slate-900">{displayPhone}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</label>
                <div className="text-sm font-semibold text-slate-900">{displayLocation}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timezone</label>
                <div className="text-sm font-semibold text-slate-900">{displayTimezone}</div>
              </div>
            </div>
          </div>

          {/* Account Security */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">Account Security</h2>
            </div>
            <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Password</div>
                <div className="text-xs font-medium text-slate-500 mt-1">
                  {formatPasswordDate(profileData?.passwordChangedAt || currentUser?.passwordChangedAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                Change Password
              </button>
            </div>
          </div>

          {/* Activity History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">Activity History</h2>
            </div>
            <div className="p-6">
              <div className="relative border-l-2 border-slate-100 ml-4 space-y-6 pb-2">
                {activities.map((activity) => (
                  <div key={activity.id} className="relative pl-6">
                    <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full ${activity.bg} flex items-center justify-center border-4 border-white`}>
                      <span className={`material-symbols-outlined text-[14px] ${activity.color}`}>{activity.icon}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{activity.action}</div>
                      <div className="text-xs font-medium text-slate-500 mt-0.5">{activity.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Modals */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        user={profileData}
        onProfileUpdated={handleProfileUpdated}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        onPasswordChanged={handlePasswordChanged}
      />
    </div>
  );
};
