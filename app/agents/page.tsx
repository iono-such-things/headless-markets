// Issue #75 — Wire /app/agents page to real /api/agents endpoint
// Builder A — Build #76 — 2026-03-03
'use client';

import { useEffect, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  slug: string;
  role: string;
  status: 'active' | 'paused' | 'building';
  builds?: number;
  lastBuild?: string;
  stack?: string[];
  description?: string;
  verified?: boolean;
}

interface AgentsResponse {
  agents: Agent[];
  count: number;
  timestamp: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: '#00ff88',
  building: '#ffcc00',
  paused: '#555',
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents', {
          headers: { 'x-payment-tier': 'free' },
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: AgentsResponse = await res.json();
        setAgents(data.agents ?? []);
        setTimestamp(data.timestamp);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'fetch failed');
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
    const interval = setInterval(fetchAgents, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section style={{ padding: '40px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '32px' }}>
        <h2 style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', fontWeight: 500, color: '#e8e8e8', margin: 0 }}>
          Agent Registry
        </h2>
        {!loading && !error && (
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#555' }}>
            {agents.length} agents · live
            {timestamp && ` · ${new Date(timestamp).toLocaleTimeString()}`}
          </span>
        )}
      </div>

      {loading && (
        <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#555' }}>
          fetching agent registry...
        </p>
      )}

      {error && (
        <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#ff4444' }}>
          error: {error}
        </p>
      )}

      {!loading && !error && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {agents.map((agent) => (
            <a
              key={agent.id}
              href={`/app/agents/${agent.id}`}
              style={{
                display: 'block',
                background: '#0d0d0d',
                border: '1px solid #1e1e1e',
                borderRadius: '6px',
                padding: '20px',
                textDecoration: 'none',
                transition: 'border-color 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e1e1e')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', fontWeight: 500, color: '#e8e8e8' }}>
                  {agent.name}
                  {agent.verified && (
                    <span style={{ color: '#4488ff', marginLeft: '6px', fontSize: '10px' }}>✓</span>
                  )}
                </span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: STATUS_COLOR[agent.status] ?? '#555', letterSpacing: '0.05em' }}>
                  {agent.status}
                </span>
              </div>
              <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#777', margin: '0 0 10px 0' }}>
                {agent.role}
              </p>
              {agent.description && (
                <p style={{ fontSize: '12px', color: '#b0b0b0', margin: '0 0 12px 0', lineHeight: '1.5' }}>
                  {agent.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: '12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#555', marginBottom: agent.stack?.length ? '12px' : '0' }}>
                {agent.builds != null && <span>{agent.builds} builds</span>}
                {agent.lastBuild && <span>last: {agent.lastBuild}</span>}
              </div>
              {agent.stack && agent.stack.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {agent.stack.slice(0, 4).map((s) => (
                    <span key={s} style={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: '10px',
                      color: '#00ff88',
                      background: 'rgba(0,255,136,0.07)',
                      border: '1px solid rgba(0,255,136,0.15)',
                      borderRadius: '3px',
                      padding: '2px 6px',
                    }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </a>
          ))}
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#555' }}>
          no agents registered yet
        </p>
      )}
    </section>
  );
}
