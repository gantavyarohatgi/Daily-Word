/**
 * API client for Lexis backend.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const API = `${BASE}/api`;
const TOKEN_KEY = 'lexis_token';
const USER_KEY = 'lexis_user';

let memToken: string | null = null;

export async function setAuth(token: string, user: any) {
  memToken = token;
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function clearAuth() {
  memToken = null;
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function loadAuth(): Promise<{ token: string | null; user: any | null }> {
  const [[, t], [, u]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
  memToken = t;
  return { token: t, user: u ? JSON.parse(u) : null };
}

async function req<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as any),
  };
  if (memToken) headers.Authorization = `Bearer ${memToken}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const api = {
  signup: (email: string, password: string, name: string) =>
    req('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    req('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => req('/auth/me'),
  today: () => req('/today'),
  words: () => req('/words'),
  word: (id: string) => req(`/words/${id}`),
  practice: (word_id: string, sentences: string[]) =>
    req('/practice', { method: 'POST', body: JSON.stringify({ word_id, sentences }) }),
  startRevision: (count: number) =>
    req('/revision/start', { method: 'POST', body: JSON.stringify({ count }) }),
  revisionAnswer: (revision_id: string, word_id: string, meaning: string, sentences: string[]) =>
    req('/revision/answer', {
      method: 'POST',
      body: JSON.stringify({ revision_id, word_id, meaning, sentences }),
    }),
  finishRevision: (revision_id: string) =>
    req(`/revision/${revision_id}/finish`, { method: 'POST' }),
  revisionHistory: () => req('/revision/history'),
  stats: () => req('/stats'),
};

export type Word = {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  unlocked_date: string;
  unlocked_at: string;
  practiced: boolean;
};
