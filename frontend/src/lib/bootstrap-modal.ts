'use client';

import { useEffect } from 'react';

export function waitForBootstrap(
  onReady: (B: any) => void,
  timeoutMs = 3000,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const B = (window as any).bootstrap;
  if (B && B.Modal) {
    onReady(B);
    return () => {};
  }
  let cancelled = false;
  const end = Date.now() + timeoutMs;
  const iv = window.setInterval(() => {
    if (cancelled) {
      window.clearInterval(iv);
      return;
    }
    const NowB = (window as any).bootstrap;
    if (NowB && NowB.Modal) {
      window.clearInterval(iv);
      onReady(NowB);
      return;
    }
    if (Date.now() > end) window.clearInterval(iv);
  }, 30);
  const ev = () => {
    const NowB = (window as any).bootstrap;
    if (NowB && NowB.Modal) {
      window.clearInterval(iv);
      onReady(NowB);
    }
  };
  window.addEventListener('bootstrap:ready', ev);
  return () => {
    cancelled = true;
    window.clearInterval(iv);
    window.removeEventListener('bootstrap:ready', ev);
  };
}

export function useBindBootstrapModal(
  ref: React.MutableRefObject<HTMLDivElement | null>,
  bsRef: React.MutableRefObject<any>,
  open: boolean,
  onBeforeShow?: () => void,
  opts?: any,
  onCancelHide?: () => void,
) {
  useEffect(() => {
    if (!ref.current) return;
    let cancel: (() => void) | undefined;
    cancel = waitForBootstrap((B: any) => {
      if (!ref.current) return;
      if (!bsRef.current) {
        bsRef.current = new B.Modal(ref.current, opts ?? { backdrop: 'static', keyboard: false });
        if (onCancelHide) {
          ref.current.addEventListener('hidden.bs.modal', onCancelHide as any);
        }
      }
      if (open) {
        onBeforeShow?.();
        bsRef.current.show();
      } else {
        bsRef.current.hide();
      }
    });
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
