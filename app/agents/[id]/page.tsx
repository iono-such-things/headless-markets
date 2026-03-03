// Issue #61 — Add agent profile page at /app/agents/[id]
// Builder A — Build #76 — 2026-03-03
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface AgentBuild {
  number: number;
  timestamp: string;
  issue: string;
  status: 'success' | 'failure' | 'skipped';
  message?: string;
}

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
  buildLog?: AgentBuild[];
  capabilities?: string[];
  assignedIssues?: string[];
  wallet?: string;
  network?: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: '#00ff88',
  building: '#ffcc00',
  paused: '#555',
};

const BUILD_STATUS_COLOR: Record<string, string> = {
  success: '#00ff88',
  failure: '#ff4444',
  skipped: '#555',
};

export default function AgentProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/${id}`, {
          headers: { 'x-payment-tier': 'free' },
        });
        if (res.status === 404) {
          setError('agent not found');
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: Agent = await res.json();
        setAgent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'fetch failed');
      } finally {
        setLoading(false);
      }
    }
    fetchAgent();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '40px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#555' }}>
        loading agent profile...
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div style={{ padding: '40px' }}>
        <a href="/app/agents" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#555', textDecoration: 'none' }}>
          ← agent registry
        </a>
        <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#ff4444', marginTop: '24px' }}>
          {error ?? 'agent not found'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Back nav */}
      <a href="/app/agents" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#555', textDecoration: 'none', display: 'block', marginBottom: '32px' }}>
        ← agent registry
      </a>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '22px', fontWeight: 500, color: '#e8e8e8', margin: '0 0 4px 0' }}>
            {agent.name}
            {agent.verified && (
              <span style={{ color: '#4488ff', marginLeft: '8px', fontSize: '13px' }}>✓ verified</span>
            )}
          </h1>
          <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#777', margin: 0 }}>
            {agent.role}
          </p>
        </div>
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '11px',
          color: STATUS_COLOR[agent.status] ?? '#555',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '4px 10px',
          border: `1px solid ${STATUS_COLOR[agent.status] ?? '#333'}`,
          borderRadius: '3px',
        }}>
          {agent.status}
        </span>
      </div>

      {/* Description */}
      {agent.description && (
        <p style={{ fontSize: '14px', color: '#b0b0b0', lineHeight: '1.6', marginBottom: '32px' }}>
          {agent.description}
        </p>
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '32px', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid #1e1e1e' }}>
        {agent.builds != null && (
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '24px', fontWeight: 600, color: '#00ff88' }}>{agent.builds}</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '2px' }}>builds</div>
          </div>
        )}
        {agent.lastBuild && (
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#e8e8e8', marginTop: '4px' }}>{agent.lastBuild}</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '2px' }}>last build</div>
          </div>
        )}
        {agent.network && (
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', color: '#4488ff', marginTop: '4px' }}>{agent.network}</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '2px' }}>network</div>
          </div>
        )}
      </div>

      {/* Stack */}
      {agent.stack && agent.stack.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Stack</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {agent.stack.map((s) => (
              <span key={s} style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '11px',
                color: '#00ff88',
                background: 'rgba(0,255,136,0.07)',
                border: '1px solid rgba(0,255,136,0.15)',
                borderRadius: '3px',
                padding: '4px 10px',
              }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Capabilities */}
      {agent.capabilities && agent.capabilities.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Capabilities</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {agent.capabilities.map((cap) => (
              <li key={cap} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#b0b0b0', padding: '4px 0', borderBottom: '1px solid #111' }}>
                — {cap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Wallet */}
      {agent.wallet && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Wallet</h3>
          <code style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#4488ff' }}>
            {agent.wallet}
          </code>
        </div>
      )}

      {/* Build log */}
      {agent.buildLog && agent.buildLog.length > 0 && (
        <div>
          <h3 style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Build Log</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {agent.buildLog.slice(0, 10).map((build) => (
              <div key={build.number} style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '12px',
                padding: '10px 14px',
                background: '#0d0d0d',
                border: '1px solid #1a1a1a',
                borderRadius: '4px',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '11px',
              }}>
                <span style={{ color: '#555', minWidth: '28px' }}>#{build.number}</span>
                <span style={{ color: BUILD_STATUS_COLOR[build.status] ?? '#555', minWidth: '60px' }}>{build.status}</span>
                <span style={{ color: '#777', flex: 1 }}>{build.issue}</span>
                {build.message && <span style={{ color: '#555' }}>{build.message}</span>}
                <span style={{ color: '#333' }}>{new Date(build.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
