import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Database,
  ExternalLink,
  Globe,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Tablet,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { TrafficSummaryResponse } from '../../functions/api/analytics/helpers.ts';
import { formatRelativeDate } from '../utils/formatters.ts';
import {
  getAnonymousVisitorId,
  isSelfAnalyticsExcluded,
  setSelfAnalyticsExcluded,
} from '../utils/visitorAnalytics.ts';

const VISITOR_ANALYTICS_TABLE_SQL = `-- Create visitor_pageviews table for real human Visitors by Country analytics
create table if not exists public.visitor_pageviews (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  session_id text not null,
  country_code text not null default 'XX',
  country_name text not null default 'Unknown',
  city text not null default '',
  region text not null default '',
  page_path text not null default '/',
  page_view text not null default 'streaming',
  referrer_host text not null default '',
  device_type text not null default 'desktop',
  created_at timestamptz not null default now()
);

create index if not exists idx_visitor_pageviews_created_at
  on public.visitor_pageviews(created_at desc);
create index if not exists idx_visitor_pageviews_country
  on public.visitor_pageviews(country_code, created_at desc);
create index if not exists idx_visitor_pageviews_visitor
  on public.visitor_pageviews(visitor_id, created_at desc);

alter table public.visitor_pageviews enable row level security;

drop policy if exists "Visitor pageviews insert" on public.visitor_pageviews;
create policy "Visitor pageviews insert" on public.visitor_pageviews for insert with check (true);
drop policy if exists "Visitor pageviews read" on public.visitor_pageviews;
create policy "Visitor pageviews read" on public.visitor_pageviews for select using (true);`;

type RangeOption = '24h' | '7d' | '30d' | 'all';

const RANGE_OPTIONS: Array<{ id: RangeOption; label: string }> = [
  { id: '24h', label: 'Last 24 Hours' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'all', label: 'All Time' },
];

export const AdminTrafficByCountryPanel: React.FC = () => {
  const [range, setRange] = useState<RangeOption>('7d');
  const [excludeSelf, setExcludeSelf] = useState<boolean>(() => isSelfAnalyticsExcluded());
  const [countryFilter, setCountryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TrafficSummaryResponse | null>(null);
  const [copiedTableSql, setCopiedTableSql] = useState(false);

  const loadSummary = useCallback(
    async (selectedRange: RangeOption, shouldExcludeSelf: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ range: selectedRange });
        if (shouldExcludeSelf) {
          const ownId = getAnonymousVisitorId();
          if (ownId) params.set('excludeVisitorId', ownId);
        }
        const res = await fetch(`/api/analytics/summary?${params.toString()}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = (await res.json()) as TrafficSummaryResponse;
          setSummary(data);
        }
      } catch {
        // Keep previous state on transient network error
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadSummary(range, excludeSelf);
  }, [range, excludeSelf, loadSummary]);

  const handleToggleExcludeSelf = () => {
    const next = !excludeSelf;
    setExcludeSelf(next);
    setSelfAnalyticsExcluded(next);
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(VISITOR_ANALYTICS_TABLE_SQL);
      setCopiedTableSql(true);
      window.setTimeout(() => setCopiedTableSql(false), 3000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const filteredCountries = useMemo(() => {
    if (!summary?.countries) return [];
    const q = countryFilter.trim().toLowerCase();
    if (!q) return summary.countries;
    return summary.countries.filter(
      (c) =>
        c.countryName.toLowerCase().includes(q) ||
        c.countryCode.toLowerCase().includes(q) ||
        c.topCity.toLowerCase().includes(q)
    );
  }, [summary, countryFilter]);

  const topCountry = summary?.countries?.[0] || null;
  const maxDailyVisitors = useMemo(() => {
    if (!summary?.dailyTrend?.length) return 1;
    return Math.max(1, ...summary.dailyTrend.map((d) => d.uniqueVisitors));
  }, [summary]);

  const totalDeviceUsers = summary
    ? summary.devices.mobile + summary.devices.desktop + summary.devices.tablet
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Controls */}
      <div className="p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>HUMAN-ONLY · BOTS FILTERED</span>
            </span>
            {summary && (
              <span className="text-[11px] font-mono text-zinc-400">
                Storage:{' '}
                <strong className="text-zinc-200 uppercase">
                  {summary.storage === 'supabase'
                    ? 'Supabase Cloud + CF-IPCountry'
                    : summary.storage === 'local'
                      ? 'Local Dev Store'
                      : 'Supabase Env Needed'}
                </strong>
              </span>
            )}
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-zinc-50 flex items-center gap-2 mt-1">
            <Globe className="w-5 h-5 text-amber-400" />
            <span>Visitors by Country &amp; Real Traction</span>
          </h2>
          <p className="text-xs text-zinc-400 max-w-2xl">
            Uses Cloudflare’s verified <code className="text-amber-300">CF-IPCountry</code> edge header and browser execution verification to count real human visitors by country — excluding WordPress scanners, crawlers, and raw bot probes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Range Pills */}
          <div className="inline-flex items-center p-1 rounded-xl bg-zinc-950 border border-zinc-800">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  range === opt.id
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Exclude Owner Browser Toggle */}
          <button
            type="button"
            onClick={handleToggleExcludeSelf}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              excludeSelf
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Exclude your own browser from visitor counts so you only see external visitors"
          >
            <Check className={`w-3.5 h-3.5 ${excludeSelf ? 'opacity-100' : 'opacity-30'}`} />
            <span>{excludeSelf ? 'Excluding My Browser' : 'Exclude My Browser'}</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => loadSummary(range, excludeSelf)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* One-Time Supabase Table Setup Banner (only shown if table isn't created yet) */}
      {summary?.tableMissing && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-200">
                  One-Time Setup Required: Create the <code className="text-amber-300">visitor_pageviews</code> Table in Supabase
                </h3>
                <p className="text-xs text-zinc-300 mt-1">
                  Your Cloudflare Edge tracker is ready. Run this short SQL snippet once in your Supabase SQL Editor so live visits by country begin saving permanently.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors"
              >
                {copiedTableSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTableSql ? 'SQL Copied!' : 'Copy Table SQL'}</span>
              </button>
              <a
                href="https://supabase.com/dashboard/project/hswbafspnhgojjuyhnqa/sql"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-medium"
              >
                <span>Open SQL Editor</span>
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              </a>
            </div>
          </div>
          <pre className="p-3.5 rounded-xl bg-zinc-950/90 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-48">
            {VISITOR_ANALYTICS_TABLE_SQL}
          </pre>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono tabular-nums">
        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
          <div className="flex items-center justify-between text-xs font-sans text-zinc-400">
            <span>Unique Real People</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-zinc-50 mt-2">
            {(summary?.totals.uniqueVisitors ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] font-sans text-zinc-500 mt-1">
            {(summary?.totals.uniqueSessions ?? 0).toLocaleString()} human sessions
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
          <div className="flex items-center justify-between text-xs font-sans text-zinc-400">
            <span>Human Pageviews</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-zinc-50 mt-2">
            {(summary?.totals.totalPageviews ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] font-sans text-zinc-500 mt-1">
            {summary && summary.totals.uniqueVisitors > 0
              ? `${(summary.totals.totalPageviews / summary.totals.uniqueVisitors).toFixed(1)} views per visitor`
              : 'Waiting for first visit'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
          <div className="flex items-center justify-between text-xs font-sans text-zinc-400">
            <span>Countries Reached</span>
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-zinc-50 mt-2">
            {(summary?.totals.countriesCount ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] font-sans text-zinc-500 mt-1">
            Verified via CF-IPCountry
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
          <div className="flex items-center justify-between text-xs font-sans text-zinc-400">
            <span>Top Country</span>
            <span className="text-base leading-none">{topCountry?.flag || '🌍'}</span>
          </div>
          <div className="text-lg sm:text-xl font-sans font-semibold text-amber-300 mt-2 truncate">
            {topCountry ? topCountry.countryName : 'No Data Yet'}
          </div>
          <div className="text-[11px] font-sans text-zinc-500 mt-1">
            {topCountry
              ? `${topCountry.uniqueVisitors.toLocaleString()} people (${topCountry.sharePercent}%)`
              : 'Updates live as people visit'}
          </div>
        </div>
      </div>

      {/* Main Visitors by Country Table */}
      <div className="p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              Visitors by Country ({filteredCountries.length})
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Ranked by unique real people — automatically excludes bots and automated scanners.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              placeholder="Filter country or city..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {loading && !summary ? (
          <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
            <span>Loading real-time country traffic from Supabase...</span>
          </div>
        ) : filteredCountries.length === 0 ? (
          <div className="p-8 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-center text-xs text-zinc-400">
            {countryFilter.trim()
              ? `No visits matched "${countryFilter.trim()}" in this period.`
              : 'No human visits recorded yet in this period. As real visitors open www.kingdomflix.name.ng, their country and counts will appear here automatically.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-medium">
                  <th className="py-2.5 pr-3">#</th>
                  <th className="py-2.5 px-3">Country</th>
                  <th className="py-2.5 px-3 text-right">Unique People</th>
                  <th className="py-2.5 px-3 text-right">Pageviews</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Audience Share</th>
                  <th className="py-2.5 px-3">Top City</th>
                  <th className="py-2.5 pl-3 text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {filteredCountries.map((row, idx) => (
                  <tr key={row.countryCode} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="py-3 pr-3 font-mono text-zinc-500">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base leading-none">{row.flag}</span>
                        <span className="font-medium text-zinc-100">{row.countryName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                          {row.countryCode}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-amber-300">
                      {row.uniqueVisitors.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-300">
                      {row.pageviews.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-zinc-900 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{ width: `${Math.max(4, Math.min(100, row.sharePercent))}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums text-[11px] text-zinc-300 w-11 text-right">
                          {row.sharePercent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-zinc-400">
                      {row.topCity || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="py-3 pl-3 text-right text-zinc-400 whitespace-nowrap">
                      {formatRelativeDate(row.lastSeenAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily Trend + Secondary Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Traction Trend */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Daily Human Visitor Trend</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Unique people per day across the selected window
              </p>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              {summary?.dailyTrend.length || 0} active day(s)
            </span>
          </div>

          {!summary?.dailyTrend?.length ? (
            <div className="h-36 rounded-xl bg-zinc-950/60 border border-zinc-800/70 flex items-center justify-center text-xs text-zinc-500">
              Daily traction bars will populate automatically as real visitors arrive.
            </div>
          ) : (
            <div className="flex items-end gap-2 h-40 pt-4 overflow-x-auto pb-1">
              {summary.dailyTrend.map((pt) => {
                const heightPct = Math.max(10, Math.round((pt.uniqueVisitors / maxDailyVisitors) * 100));
                return (
                  <div
                    key={pt.date}
                    className="flex flex-col items-center justify-end gap-1.5 flex-1 min-w-[38px] h-full"
                    title={`${pt.date}: ${pt.uniqueVisitors} unique people, ${pt.pageviews} pageviews`}
                  >
                    <span className="text-[10px] font-mono tabular-nums text-amber-300 font-semibold">
                      {pt.uniqueVisitors}
                    </span>
                    <div className="w-full max-w-[32px] bg-zinc-900 rounded-t-md flex items-end h-24 overflow-hidden">
                      <div
                        className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-md transition-all"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                      {pt.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Devices & Traffic Sources */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 mb-3">Visitor Devices</h3>
            <div className="flex flex-col gap-2.5 text-xs">
              {[
                {
                  label: 'Mobile Phones',
                  count: summary?.devices.mobile ?? 0,
                  icon: Smartphone,
                  color: 'bg-emerald-500',
                },
                {
                  label: 'Computers / Desktop',
                  count: summary?.devices.desktop ?? 0,
                  icon: Monitor,
                  color: 'bg-amber-500',
                },
                {
                  label: 'Tablets',
                  count: summary?.devices.tablet ?? 0,
                  icon: Tablet,
                  color: 'bg-blue-500',
                },
              ].map((d) => {
                const Icon = d.icon;
                const pct =
                  totalDeviceUsers > 0 ? Math.round((d.count / totalDeviceUsers) * 100) : 0;
                return (
                  <div key={d.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{d.label}</span>
                      </span>
                      <span className="font-mono tabular-nums text-zinc-200">
                        {d.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                      <div className={`h-full ${d.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <h3 className="text-sm font-semibold text-zinc-100 mb-2.5">Top Traffic Sources</h3>
            {!summary?.topReferrers?.length ? (
              <p className="text-xs text-zinc-500">No referrer data yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {summary.topReferrers.slice(0, 5).map((ref) => (
                  <div
                    key={ref.host}
                    className="flex items-center justify-between text-xs text-zinc-300"
                  >
                    <span className="truncate pr-2">{ref.host}</span>
                    <span className="font-mono tabular-nums text-amber-300 shrink-0">
                      {ref.visits}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top App Sections & Recent Verified Human Visits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-100">Most Visited App Sections</h3>
          {!summary?.topViews?.length ? (
            <p className="text-xs text-zinc-500">No section visits recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {summary.topViews.map((v) => (
                <div
                  key={v.view}
                  className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-100 truncate">{v.label}</div>
                    <div className="text-[11px] text-zinc-500">
                      {v.uniqueVisitors.toLocaleString()} unique people
                    </div>
                  </div>
                  <span className="font-mono tabular-nums text-amber-300 font-semibold shrink-0">
                    {v.pageviews.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-100">Recent Verified Human Visits</h3>
          {!summary?.recentVisits?.length ? (
            <p className="text-xs text-zinc-500">
              Recent anonymized visits will appear here as visitors browse Kingdom+.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 px-3">Section</th>
                    <th className="py-2 px-3">Device</th>
                    <th className="py-2 px-3">Source</th>
                    <th className="py-2 pl-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {summary.recentVisits.map((visit, idx) => (
                    <tr key={`${visit.createdAt}-${idx}`}>
                      <td className="py-2.5 pr-3 text-zinc-100 whitespace-nowrap">
                        <span className="mr-1.5">{visit.flag}</span>
                        <span>{visit.countryName}</span>
                        {visit.city && (
                          <span className="text-zinc-500 ml-1">· {visit.city}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-300 truncate max-w-[180px]">
                        {visit.pageView}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 capitalize">{visit.deviceType}</td>
                      <td className="py-2.5 px-3 text-zinc-400 truncate max-w-[140px]">
                        {visit.referrerHost}
                      </td>
                      <td className="py-2.5 pl-3 text-right text-zinc-500 whitespace-nowrap">
                        {formatRelativeDate(visit.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
