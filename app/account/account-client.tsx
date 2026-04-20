'use client';

import { useState, useEffect } from 'react';
import { Session } from 'next-auth';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/app/theme-provider';

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
];

interface AccountClientProps {
  session: Session;
}

export default function AccountClient({ session: initialSession }: AccountClientProps) {
  const { data: session, update } = useSession();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(session?.user?.name || initialSession.user?.name || '');
  const [timezone, setTimezone] = useState('America/New_York');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/account/settings')
      .then(r => r.json())
      .then(d => { if (d.timezone) setTimezone(d.timezone); })
      .catch(() => {});
  }, []);

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
        body: JSON.stringify({ name, timezone }),
      });

      if (response.ok) {
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
        <h1 className="text-3xl font-bold text-text-primary mb-2">Account Settings</h1>
        <p className="text-text-secondary">Manage your profile and preferences</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success'
            ? 'bg-profit/10 border border-profit/50 text-profit'
            : 'bg-loss/10 border border-loss/50 text-loss'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-surface-1 border border-border rounded-xl p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">Profile Information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-2 text-text-primary rounded-lg px-4 py-2 border border-border placeholder-text-muted focus:ring-1 focus:ring-accent focus:border-accent focus:outline-none"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={session?.user?.email || initialSession.user?.email || ''}
              disabled
              className="w-full bg-surface-2 text-text-muted rounded-lg px-4 py-2 border border-border cursor-not-allowed opacity-60"
            />
            <p className="text-xs text-text-muted mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-surface-2 text-text-primary rounded-lg px-4 py-2 border border-border focus:ring-1 focus:ring-accent focus:border-accent focus:outline-none"
            >
              {COMMON_TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1">Used for analytics date calculations</p>
          </div>

          <button
            onClick={updateProfile}
            disabled={loading}
            className="px-6 py-2 bg-accent text-white hover:bg-accent-hover font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </div>

      {/* Password Section */}
      <div className="bg-surface-1 border border-border rounded-xl p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">Change Password</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-surface-2 text-text-primary rounded-lg px-4 py-2 border border-border placeholder-text-muted focus:ring-1 focus:ring-accent focus:border-accent focus:outline-none"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-surface-2 text-text-primary rounded-lg px-4 py-2 border border-border placeholder-text-muted focus:ring-1 focus:ring-accent focus:border-accent focus:outline-none"
              placeholder="Enter new password (min 8 characters)"
            />
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-surface-2 text-text-primary rounded-lg px-4 py-2 border border-border placeholder-text-muted focus:ring-1 focus:ring-accent focus:border-accent focus:outline-none"
              placeholder="Confirm new password"
            />
          </div>

          <button
            onClick={changePassword}
            disabled={loading}
            className="px-6 py-2 bg-accent text-white hover:bg-accent-hover font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Theme Section */}
      <div className="bg-surface-1 border border-border rounded-xl p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">Theme</h2>

        <div className="flex gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              theme === 'light'
                ? 'bg-accent text-white'
                : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
            }`}
          >
            Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-accent text-white'
                : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
            }`}
          >
            Dark
          </button>
        </div>
      </div>
    </div>
  );
}
