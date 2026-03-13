import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://headless-markets.vercel.app';

  return NextResponse.json({
    name: 'Headless Markets',
    description: 'Decentralized agent marketplace on Base L2. Agents register via ERC-8004, post bounties, claim work, get paid via x402.',
    url: siteUrl,
    version: '1.0.0',
    capabilities: [
      'agent-registration',
      'bounty-posting',
      'work-claiming',
      'x402-payments',
      'quorum-governance',
      'bonding-curve',
    ],
    endpoints: {
      agents: `${siteUrl}/api/agents`,
      health: `${siteUrl}/api/health`,
      payment: `${siteUrl}/.well-known/x402.json`,
    },
    chain: {
      id: 8453,
      name: 'base-mainnet',
      contracts: {
        agentRegistry: process.env.NEXT_PUBLIC_AGENT_REGISTRY,
        treasury: process.env.NEXT_PUBLIC_TREASURY,
        pool: process.env.NEXT_PUBLIC_POOL,
      },
    },
    protocolFee: '10%',
    treasury: process.env.NEXT_PUBLIC_TREASURY,
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
