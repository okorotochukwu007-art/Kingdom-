import React, { useState } from 'react';
import { Gauge, LogOut, Shield, User, X } from 'lucide-react';
import { ContentCategory, KingdomVideo, UserProfile, WatchHistoryEntry } from '../types/kingdom.ts';
import { VideoCard } from './VideoCard.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import {
  registerUser,
  loginUser,
  resetUserPassword,
  updateProfile,
} from '../utils/authService.ts';
import { useDataSaver } from '../hooks/useDataSaver.ts';
import { DataSaverPreference } from '../utils/dataSaver.ts';

interface AuthAndProfileModalProps {
  currentUser: UserProfile | null;
  authToken: string | null;
  categories: ContentCategory[];
  savedVideos: KingdomVideo[];
  watchHistory: WatchHistoryEntry[];
  onClose: () => void;
  onAuthSuccess: (token: string, user: UserProfile) => void;
  onLogout: () => void;
  onSelectVideo: (video: KingdomVideo) => void;
  onToggleSave: (videoId: string, e: React.MouseEvent) => void;
  onOpenAdmin: () => void;
}

export const AuthAndProfileModal: React.FC<AuthAndProfileModalProps> = ({
  currentUser,
  authToken,
  categories,
  savedVideos,
  watchHistory,
  onClose,
  onAuthSuccess,
  onLogout,
  onSelectVideo,
  onToggleSave,
  onOpenAdmin,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('Lagos, Nigeria');
  const [denomination, setDenomination] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Profile editing state when logged in
  const [profileTab, setProfileTab] = useState<'watchlist' | 'history' | 'settings'>('watchlist');
  const [editBio, setEditBio] = useState(currentUser?.bio || '');
  const [editLocation, setEditLocation] = useState(currentUser?.location || '');
  const [editChurch, setEditChurch] = useState(currentUser?.denomination_or_church || '');
  const {
    preference: dataSaverPreference,
    isDataSaverActive,
    deviceSaveData,
    effectiveType,
    setPreference: setDataSaverPreference,
  } = useDataSaver();
  const [favCategories, setFavCategories] = useState<string[]>(
    currentUser?.preferences?.favoriteCategories || []
  );

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (authMode === 'reset') {
        const msg = await resetUserPassword(email, password);
        setMessage(msg);
        setAuthMode('login');
        return;
      }

      if (authMode === 'register') {
        const result = await registerUser({
          email,
          password,
          fullName,
          username,
          location,
          denomination,
        });
        onAuthSuccess(result.token, result.user);
      } else {
        const result = await loginUser(email, password);
        onAuthSuccess(result.token, result.user);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setLoading(true);
    try {
      const updated = await updateProfile(authToken, {
        bio: editBio,
        location: editLocation,
        denomination_or_church: editChurch,
        preferences: {
          favoriteCategories: favCategories,
          favoriteMinisters: currentUser?.preferences?.favoriteMinisters || [],
        },
      });
      onAuthSuccess(authToken, updated);
      setMessage('Profile & recommendation preferences saved.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save preferences.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavCategory = (slug: string) => {
    setFavCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md overflow-y-auto flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-[#121215] border border-zinc-800 p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-xl font-semibold text-amber-400">KINGDOM+</span>
            <span className="text-zinc-600">·</span>
            <span className="text-sm font-medium text-zinc-200">
              {currentUser ? 'Member Sanctuary & Watchlist' : 'Member Account & Cloud Sync'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!currentUser ? (
          <form onSubmit={handleAuthSubmit} className="max-w-md mx-auto flex flex-col gap-4 py-2">
            <p className="text-xs text-zinc-400 text-center">
              Watching is always free with no sign-in required. Sign in or create a free account to post comments, join community chat, and sync your watchlist across devices.
            </p>

            <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                  authMode === 'register'
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                  authMode === 'login'
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('reset');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                  authMode === 'reset'
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Reset Password
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
                {error}
              </div>
            )}
            {message && (
              <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                {message}
              </div>
            )}

            {authMode === 'register' && (
              <>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Chukwudi Okoro"
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="chukwudi_ng"
                      className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">City & Country</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Lagos, Nigeria"
                      className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Home Church / Ministry (Optional)
                  </label>
                  <input
                    type="text"
                    value={denomination}
                    onChange={(e) => setDenomination(e.target.value)}
                    placeholder="e.g. Streams of Joy, RCCG, Dunamis, Koinonia..."
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {authMode === 'reset' ? 'New Password (min 6 characters)' : 'Password'}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors"
            >
              {loading
                ? 'Please wait...'
                : authMode === 'login'
                ? 'Sign In to KINGDOM+'
                : authMode === 'register'
                ? 'Create KINGDOM+ Account'
                : 'Update Password'}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Logged-in Member Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 font-semibold flex items-center justify-center text-base">
                  {currentUser.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-base font-semibold text-zinc-100">
                    {currentUser.full_name}
                  </div>
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <span>@{currentUser.username}</span>
                    <span>·</span>
                    <span>{currentUser.email}</span>
                    <span>·</span>
                    <span className="text-amber-400 capitalize">{currentUser.role.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {(currentUser.role === 'admin' ||
                  currentUser.role === 'super_admin' ||
                  currentUser.role === 'moderator') && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdmin();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin Dashboard</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Mobile PWA Install Banner (Android 1-tap & iOS Safari Guide) */}
            <PWAInstallButton variant="banner" />

            {/* Sub-tabs */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              {[
                { id: 'watchlist', label: `Saved Videos (${savedVideos.length})` },
                { id: 'history', label: `Watch History (${watchHistory.length})` },
                { id: 'settings', label: 'Profile & Preferences' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setProfileTab(t.id as any)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium ${
                    profileTab === t.id
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {profileTab === 'watchlist' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-1">
                {savedVideos.length === 0 ? (
                  <div className="col-span-2 py-12 text-center text-xs text-zinc-500">
                    You have not saved any videos to your watchlist yet.
                  </div>
                ) : (
                  savedVideos.map((v) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      onSelect={(vid) => {
                        onClose();
                        onSelectVideo(vid);
                      }}
                      isSaved={true}
                      onToggleSave={onToggleSave}
                    />
                  ))
                )}
              </div>
            )}

            {profileTab === 'history' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-1">
                {watchHistory.length === 0 ? (
                  <div className="col-span-2 py-12 text-center text-xs text-zinc-500">
                    Your watch history is currently empty.
                  </div>
                ) : (
                  watchHistory.map(
                    (entry) =>
                      entry.video && (
                        <VideoCard
                          key={entry.id}
                          video={entry.video}
                          onSelect={(vid) => {
                            onClose();
                            onSelectVideo(vid);
                          }}
                          isSaved={savedVideos.some((s) => s.id === entry.video?.id)}
                          onToggleSave={onToggleSave}
                          watchProgressSeconds={entry.progress_seconds}
                          watchDurationSeconds={entry.duration_seconds}
                        />
                      )
                  )
                )}
              </div>
            )}

            {profileTab === 'settings' && (
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
                {message && (
                  <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                    {message}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Location</label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Home Church / Ministry
                    </label>
                    <input
                      type="text"
                      value={editChurch}
                      onChange={(e) => setEditChurch(e.target.value)}
                      className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Member Bio</label>
                  <textarea
                    rows={2}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">
                    Preferred Categories (Personalizes your Homepage Recommendations)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const active = favCategories.includes(cat.slug);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleFavCategory(cat.slug)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Mobile Data-Saver Preference Card */}
                <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Gauge
                        className={`w-4 h-4 ${
                          isDataSaverActive ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      />
                      <span className="text-xs font-semibold text-zinc-100">
                        Mobile Data-Saver Mode
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isDataSaverActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isDataSaverActive ? 'Active' : 'Standard HD'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Loads lighter 16:9 thumbnails, requests 360p/480p stream quality, and reduces background network checks.
                    {deviceSaveData
                      ? ' Your device Data Saver is currently enabled.'
                      : effectiveType
                      ? ` Current connection: ${effectiveType.toUpperCase()}.`
                      : ''}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'auto', label: 'Auto (Device)' },
                        { id: 'on', label: 'Always On' },
                        { id: 'off', label: 'Standard HD' },
                      ] as { id: DataSaverPreference; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDataSaverPreference(opt.id)}
                        className={`py-2 px-2 rounded-lg text-[11px] font-medium border transition-colors ${
                          dataSaverPreference === opt.id
                            ? 'bg-amber-500 text-zinc-950 border-amber-400 font-semibold'
                            : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold"
                  >
                    Save Preferences
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
