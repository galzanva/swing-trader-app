'use client';

import { useState, useEffect } from 'react';
import { Session } from 'next-auth';
import { useSession } from 'next-auth/react';

interface AccountClientProps {
  session: Session;
}

interface UsageStats {
  strategiesCreated: number;
  analysesRan: number;
  scannersRan: number;
}

export default function AccountClient({ session: initialSession }: AccountClientProps) {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name || initialSession.user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats>({ strategiesCreated: 0, analysesRan: 0, scannersRan: 0 });

  useEffect(() => {
    fetchUsageStats();
  }, []);

  const fetchUsageStats = async () => {
    try {
      const response = await fetch('/api/account/usage');
      if (response.ok) {
        const data = await response.json();
        setUsageStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch usage stats:', err);
    }
  };

  const updateProfile = async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Name cannot be empty' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/account/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        // Update the session to reflect new name
        await update({ name });
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'All password fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Account Settings</h1>
        <p className="text-blue-200">Manage your profile and view usage statistics</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success'
            ? 'bg-green-500/20 border border-green-500/50 text-green-200'
            : 'bg-red-500/20 border border-red-500/50 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">Profile Information</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/10 text-white rounded-lg px-4 py-2 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={session?.user?.email || initialSession.user?.email || ''}
              disabled
              className="w-full bg-white/5 text-blue-300 rounded-lg px-4 py-2 border border-white/10 cursor-not-allowed"
            />
            <p className="text-xs text-blue-300 mt-1">Email cannot be changed</p>
          </div>

          <button
            onClick={updateProfile}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </div>

      {/* Password Section */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">Change Password</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-white/10 text-white rounded-lg px-4 py-2 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-white/10 text-white rounded-lg px-4 py-2 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
              placeholder="Enter new password (min 8 characters)"
            />
          </div>

          <div>
            <label className="block text-blue-200 text-sm font-medium mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/10 text-white rounded-lg px-4 py-2 border border-white/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
              placeholder="Confirm new password"
            />
          </div>

          <button
            onClick={changePassword}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-xl font-bold text-white mb-4">Usage Statistics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-3xl font-bold text-purple-300">{usageStats.strategiesCreated}</div>
            <div className="text-sm text-blue-200 mt-1">Strategies Created</div>
          </div>
          
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-3xl font-bold text-teal-300">{usageStats.analysesRan}</div>
            <div className="text-sm text-blue-200 mt-1">Analyses Ran</div>
          </div>
          
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-3xl font-bold text-blue-300">{usageStats.scannersRan}</div>
            <div className="text-sm text-blue-200 mt-1">Scanners Ran</div>
          </div>
        </div>
      </div>
    </div>
  );
}
