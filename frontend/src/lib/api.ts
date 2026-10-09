'use client';

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { UserSession } from './types';

const STORAGE_KEY = 'crm.session.v1';

export const API_BASE =
  (typeof window !== 'undefined'
    ? ((process as any).env?.NEXT_PUBLIC_API_BASE_URL as string)
    : undefined) || 'http://localhost:3000/api/v1';

export const http = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

export function getSession(): UserSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function saveSession(session: UserSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const session = getSession();
  if (session?.accessToken && config.headers) {
    (config.headers as any).Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

export function humanizeToken(str: string) {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPEN(num: string | number) {
  const n = typeof num === 'string' ? parseFloat(num || '0') : Number(num || 0);
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 }).format(n);
}

export function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatDateTime(iso: string | Date | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function initials(name: string, last?: string | null) {
  const a = (name || '').trim().charAt(0).toUpperCase();
  const b = last ? (last as string).trim().charAt(0).toUpperCase() : '';
  return (a + b) || '?';
}
