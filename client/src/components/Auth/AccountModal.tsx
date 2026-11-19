import React, { useState } from 'react';
import { LogOut, UserCheck, X } from 'lucide-react';
import { api } from '~/lib/api';
import type { User } from '~/types';

type AccountModalProps = {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onAuthChanged: () => Promise<void>;
};

export const AccountModal: React.FC<AccountModalProps> = ({
  open,
  user,
  onClose,
  onAuthChanged,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const isLocalGuest = !user || user.id === 'local-user';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await api.login(email, password);
      } else {
        await api.register(name, email, password);
      }
      await onAuthChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border-theme-strong w-full max-w-md rounded-2xl border p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-primary text-lg font-semibold">Account &amp; Session</h2>
          <button type="button" onClick={onClose} className="text-secondary hover:text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-surface-alt border-theme mt-4 flex items-center justify-between rounded-xl border p-3.5">
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-emerald-500" />
            <div>
              <div className="text-primary text-sm font-medium">{user?.name}</div>
              <div className="text-tertiary text-xs">{user?.email}</div>
            </div>
          </div>
          {!isLocalGuest && (
            <button
              type="button"
              onClick={async () => {
                await api.logout();
                await onAuthChanged();
                onClose();
              }}
              className="border-theme text-secondary hover:text-primary inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          )}
        </div>

        <div className="mt-5">
          <div className="border-theme mb-4 flex border-b text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 pb-2 transition ${
                mode === 'login'
                  ? 'border-b-2 border-emerald-500 text-emerald-500'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 pb-2 transition ${
                mode === 'register'
                  ? 'border-b-2 border-emerald-500 text-emerald-500'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="text-primary mb-1 block text-xs font-medium">Display Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-3 py-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="text-primary mb-1 block text-xs font-medium">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-primary mb-1 block text-xs font-medium">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="bg-surface-alt border-theme text-primary w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
