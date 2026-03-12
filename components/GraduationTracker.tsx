'use client';

import type { AgentGraduationStatus } from '@/app/api/graduation/route';

interface GraduationTrackerProps {
  agent: AgentGraduationStatus;
}

export default function GraduationTracker({ agent }: GraduationTrackerProps) {
  const truncateAddress = (address: string) => {
    if (address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStatusBadge = () => {
    switch (agent.status) {
      case 'GRADUATED':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-mono font-semibold rounded" style={{ backgroundColor: '#00ff88', color: '#080808' }}>
            GRADUATED
          </span>
        );
      case 'GRADUATING':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-mono font-semibold rounded animate-pulse" style={{ backgroundColor: '#0088ff', color: '#080808' }}>
            GRADUATING
          </span>
        );
      case 'BONDING':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-mono font-semibold rounded" style={{ backgroundColor: '#555555', color: '#e8e8e8' }}>
            BONDING
          </span>
        );
    }
  };

  return (
    <div className="bg-[#0f0f0f] border border-white/10 rounded p-4 font-mono">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-white/60">
          Agent {truncateAddress(agent.agentId)}
        </div>
        {getStatusBadge()}
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-white/60">Bonding Curve Progress</span>
          <span className="font-semibold" style={{ color: '#00ff88' }}>
            {agent.progressPct.toFixed(2)}%
          </span>
        </div>
        <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${agent.progressPct}%`,
              backgroundColor: '#00ff88',
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-white/60">ETH Raised</span>
        <span className="font-semibold text-white/90">
          {parseFloat(agent.totalEthRaised).toFixed(4)} / 24.0000 ETH
        </span>
      </div>

      {agent.graduated && agent.uniswapPool && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Uniswap Pool</span>
            <a
              href={`https://basescan.org/address/${agent.uniswapPool}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ color: '#00ff88' }}
            >
              <span>{truncateAddress(agent.uniswapPool)}</span>
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      )}

      <div className="mt-2 text-xs text-white/40">
        Curve: {truncateAddress(agent.curveAddress)}
      </div>
    </div>
  );
}
