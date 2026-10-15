import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../lib/socket.js';
import { outreachApi } from '../api/outreachApi.js';

export const SUMMARY_KEY = ['outreach', 'summary'];

/**
 * Backend worker ke realtime events sunta hai:
 *   outreach:job       -> ek lead ka status badla (processing -> sent/failed)
 *   outreach:progress  -> campaign ke channel-wise counts
 *   outreach:campaign  -> campaign pause/resume/cancel/complete/launch
 * Handlers ref mein rakhe hain, isliye har render par re-subscribe nahi hota.
 */
export function useOutreachEvents({ onJob, onProgress, onCampaign, onReconnect }) {
  const handlers = useRef({});
  handlers.current = { onJob, onProgress, onCampaign, onReconnect };

  useEffect(() => {
    const socket = getSocket();
    const job = (p) => handlers.current.onJob?.(p);
    const progress = (p) => handlers.current.onProgress?.(p);
    const campaign = (p) => handlers.current.onCampaign?.(p);
    const reconnect = () => handlers.current.onReconnect?.();

    socket.on('outreach:job', job);
    socket.on('outreach:progress', progress);
    socket.on('outreach:campaign', campaign);
    socket.io.on('reconnect', reconnect);
    return () => {
      socket.off('outreach:job', job);
      socket.off('outreach:progress', progress);
      socket.off('outreach:campaign', campaign);
      socket.io.off('reconnect', reconnect);
    };
  }, []);
}

/** Plain query (page ke andar). Live refresh DashboardLayout wala hook karta hai. */
export function useOutreachSummaryQuery() {
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: () => outreachApi.summary().then((r) => r.data.data),
    staleTime: 10_000,
  });
}

/**
 * Sidebar ke liye: summary + socket events par (throttled) refetch.
 * Sirf DashboardLayout mein ek baar use karo.
 */
export function useOutreachSummaryLive() {
  const qc = useQueryClient();
  const timer = useRef(null);

  const refresh = useCallback(() => {
    if (timer.current) return; // 1.5s mein ek hi refetch, har message par nahi
    timer.current = setTimeout(() => {
      timer.current = null;
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
    }, 1500);
  }, [qc]);

  useOutreachEvents({ onJob: refresh, onCampaign: refresh, onReconnect: refresh });
  useEffect(() => () => clearTimeout(timer.current), []);

  return useOutreachSummaryQuery();
}
