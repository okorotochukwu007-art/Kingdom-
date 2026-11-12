import { UserProfile } from '../types/kingdom.ts';
import { getBrowserSupabaseClient } from './formatters.ts';

const TOKEN_KEY = 'kingdom_plus_token';
const USER_KEY = 'kingdom_plus_user';
const CREDENTIALS_STORE_KEY = 'kingdom_plus_cloud_auth_credentials_v1';

const DEFAULT_SUPABASE_URL = 'https://hswbafspnhgojjuyhnqa.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'sb_publishable_mscwd1aUENWUlwyCkm9aFg_CNXyRyfG';

const ADMIN_EMAIL = 'okorotochukwu007@gmail.com';

export async function hashPasswordClient(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + ':kingdom_salt_2026');
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getSupabaseInstance() {
  const url =
    (window as any).__KINGDOM_SUPABASE_URL__ ||
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;
  const key =
    (window as any).__KINGDOM_SUPABASE_KEY__ ||
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;
  return getBrowserSupabaseClient(url, key);
}

function getSavedLocalCredentials(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CREDENTIALS_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalCredential(email: string, passwordHash: string) {
  try {
    const store = getSavedLocalCredentials();
    store[email.toLowerCase()] = passwordHash;
    localStorage.setItem(CREDENTIALS_STORE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage issues
  }
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

/**
 * Register a new member:
 * Works seamlessly both on Node server and on static Cloudflare Pages via Supabase.
 */
export async function registerUser(params: {
  email: string;
  password: string;
  fullName: string;
  username: string;
  location?: string;
  denomination?: string;
}): Promise<AuthResponse> {
  const { email, password, fullName, username, location, denomination } = params;
  const normalizedEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

  if (!normalizedEmail || !password || !fullName || !cleanUsername) {
    throw new Error('Please fill in all required fields.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  // 1. Try local server API first if running with backend
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        fullName,
        username: cleanUsername,
        location,
        denomination,
      }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }
      if (data.token && data.user) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data;
      }
    }
  } catch (err: any) {
    // If it was a real API error response from the server, throw it
    if (err.message && !err.message.includes('fetch') && !err.message.includes('Unexpected token')) {
      throw err;
    }
  }

  // 2. Cloudflare Pages Direct Supabase Cloud Mode
  const sb = getSupabaseInstance();
  const pwdHash = await hashPasswordClient(password);
  saveLocalCredential(normalizedEmail, pwdHash);

  const isOwner =
    normalizedEmail === ADMIN_EMAIL ||
    normalizedEmail === ((import.meta as any).env?.VITE_ADMIN_EMAIL || '').toLowerCase();

  const newUserId = crypto.randomUUID();
  const token = 'kingdom_cloud_' + crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);

  const newProfile: UserProfile = {
    id: newUserId,
    auth_user_id: undefined,
    email: normalizedEmail,
    full_name: fullName.trim(),
    username: cleanUsername,
    avatar_url: '',
    bio: 'Believer in Christ · Streaming worship & the Word on KINGDOM+',
    location: (location || 'Lagos, Nigeria').trim(),
    denomination_or_church: (denomination || '').trim(),
    role: isOwner ? 'super_admin' : 'member',
    is_suspended: false,
    is_online: true,
    last_seen_at: new Date().toISOString(),
    preferences: {
      favoriteCategories: ['worship-praise', 'sermons-teachings', 'prayer-spiritual-warfare'],
      favoriteMinisters: [],
    },
    created_at: new Date().toISOString(),
  };

  if (sb) {
    try {
      // Check if email already exists in Supabase
      const { data: existing } = await sb
        .from('profiles')
        .select('id, email, username')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existing) {
        throw new Error('An account with this email address already exists. Please log in.');
      }

      // Check username
      const { data: userExists } = await sb
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (userExists) {
        throw new Error('This username is already taken. Please choose another.');
      }

      // Insert into Supabase profiles table
      const { error: insertErr } = await sb.from('profiles').insert([
        {
          id: newProfile.id,
          email: newProfile.email,
          full_name: newProfile.full_name,
          username: newProfile.username,
          avatar_url: newProfile.avatar_url,
          bio: newProfile.bio,
          location: newProfile.location,
          denomination_or_church: newProfile.denomination_or_church,
          role: newProfile.role,
          is_suspended: false,
          is_online: true,
          last_seen_at: newProfile.last_seen_at,
          preferences: newProfile.preferences,
          created_at: newProfile.created_at,
        },
      ]);

      if (insertErr) {
        console.warn('Supabase profile insert warning:', insertErr.message);
      }
    } catch (sbErr: any) {
      if (sbErr.message && !sbErr.message.includes('fetch')) {
        throw sbErr;
      }
    }
  }

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(newProfile));

  return { token, user: newProfile };
}

/**
 * Login existing member:
 * Works seamlessly both on Node server and on static Cloudflare Pages via Supabase.
 */
export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    throw new Error('Please enter both your email and password.');
  }

  // 1. Try server API first if running with backend
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed.');
      }
      if (data.token && data.user) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data;
      }
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('fetch') && !err.message.includes('Unexpected token')) {
      throw err;
    }
  }

  // 2. Cloudflare Pages Direct Supabase Cloud Mode
  const sb = getSupabaseInstance();
  const pwdHash = await hashPasswordClient(password);
  const localCreds = getSavedLocalCredentials();
  const savedHash = localCreds[normalizedEmail];

  let profile: UserProfile | null = null;

  if (sb) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (!error && data) {
        profile = data as UserProfile;
      }
    } catch {
      // Ignore network hiccup
    }
  }

  // Fallback to local profile if offline or Supabase paused
  if (!profile) {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) {
        const u = JSON.parse(raw);
        if (u.email?.toLowerCase() === normalizedEmail) {
          profile = u;
        }
      }
    } catch {
      // Ignore
    }
  }

  if (!profile) {
    throw new Error('No account found with this email. Please sign up to create your sanctuary profile.');
  }

  if (profile.is_suspended) {
    throw new Error('This account has been suspended by a community moderator.');
  }

  // Verify credentials
  if (savedHash && savedHash !== pwdHash) {
    throw new Error('Incorrect password. Please verify and try again.');
  }
  saveLocalCredential(normalizedEmail, pwdHash);

  // Update online state in Supabase
  if (sb) {
    try {
      await sb
        .from('profiles')
        .update({
          is_online: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', profile.id);
    } catch {
      // Ignore
    }
  }

  const token = 'kingdom_cloud_' + crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
  profile.is_online = true;
  profile.last_seen_at = new Date().toISOString();

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(profile));

  return { token, user: profile };
}

/**
 * Reset password on Cloudflare Pages or Server:
 */
export async function resetUserPassword(email: string, newPassword: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !newPassword || newPassword.length < 6) {
    throw new Error('Please enter your email and a new password with at least 6 characters.');
  }

  // Try server API
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, newPassword }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset failed.');
      return data.message || 'Password reset successfully. Please log in.';
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('fetch') && !err.message.includes('Unexpected token')) {
      throw err;
    }
  }

  // Cloudflare Pages mode
  const pwdHash = await hashPasswordClient(newPassword);
  saveLocalCredential(normalizedEmail, pwdHash);
  return 'Password reset successfully! You can now log into your sanctuary.';
}

/**
 * Update member preferences & profile in Supabase:
 */
export async function updateProfile(
  authToken: string,
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  const raw = localStorage.getItem(USER_KEY);
  const current: UserProfile = raw ? JSON.parse(raw) : ({} as any);
  const merged: UserProfile = { ...current, ...updates };

  // Try server API
  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updates),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (res.ok && data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data.user;
      }
    }
  } catch {
    // Fall back to direct Supabase update
  }

  const sb = getSupabaseInstance();
  if (sb && merged.id) {
    try {
      await sb
        .from('profiles')
        .update({
          bio: merged.bio,
          location: merged.location,
          denomination_or_church: merged.denomination_or_church,
          preferences: merged.preferences,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', merged.id);
    } catch {
      // Ignore
    }
  }

  localStorage.setItem(USER_KEY, JSON.stringify(merged));
  return merged;
}

/**
 * Get active session from localStorage and verify with Supabase:
 */
export async function getActiveUserSession(): Promise<{
  token: string | null;
  user: UserProfile | null;
}> {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);

  if (!token || !rawUser) {
    return { token: null, user: null };
  }

  try {
    let user: UserProfile = JSON.parse(rawUser);

    // Try server API if alive
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json') && res.ok) {
        const data = await res.json();
        if (data?.user) {
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          return { token, user: data.user };
        }
      }
    } catch {
      // Server not present (Cloudflare Pages static hosting)
    }

    // Refresh from Supabase directly
    const sb = getSupabaseInstance();
    if (sb && user.id) {
      try {
        const { data } = await sb
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          user = data as UserProfile;
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        }
      } catch {
        // Use cached user
      }
    }

    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

/**
 * Sign out member:
 */
export async function logoutUser(authToken: string | null): Promise<void> {
  const rawUser = localStorage.getItem(USER_KEY);
  const sb = getSupabaseInstance();

  if (rawUser && sb) {
    try {
      const user = JSON.parse(rawUser);
      if (user?.id) {
        await sb
          .from('profiles')
          .update({ is_online: false, last_seen_at: new Date().toISOString() })
          .eq('id', user.id);
      }
    } catch {
      // Ignore
    }
  }

  if (authToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch {
      // Ignore
    }
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
