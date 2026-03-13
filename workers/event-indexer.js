/**
 * Headless Markets - Cloudflare Workers Event Indexer
 * Polls Base L2 for on-chain events and syncs to Vendure DB
 * Cron: every 5 minutes
 */

const EVENT_SIGS = {
  AgentRegistered:      '0x4e2ca0515ed1aef1395f66b5303bb5d6f1bf9d61a353fa53f73f8ac9973fa9f6',
  QuorumFormed:         '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0',
  BondingCurveDeployed: '0x3d0ce9bfc3ed7d6862dbb28b2dea94561fe714a1b4d019aa8af39730d1ad7c3d',
  ReputationUpdated:    '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1',
};

async function rpcCall(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error('RPC error: ' + JSON.stringify(data.error));
  return data.result;
}

async function getLatestBlock(rpcUrl) {
  const hex = await rpcCall(rpcUrl, 'eth_blockNumber', []);
  return parseInt(hex, 16);
}

async function getLogs(rpcUrl, fromBlock, toBlock, addresses, topics) {
  return rpcCall(rpcUrl, 'eth_getLogs', [{
    fromBlock: '0x' + fromBlock.toString(16),
    toBlock:   '0x' + toBlock.toString(16),
    address: addresses,
    topics,
  }]);
}

function decodeAddress(hex) {
  return '0x' + hex.slice(-40);
}

function decodeUint256(hex) {
  return BigInt('0x' + hex).toString();
}

function decodeAddressArray(data) {
  const clean = data.startsWith('0x') ? data.slice(2) : data;
  const offset = parseInt(clean.slice(0, 64), 16) * 2;
  const length = parseInt(clean.slice(offset, offset + 64), 16);
  const addrs = [];
  for (let i = 0; i < length; i++) {
    const chunk = clean.slice(offset + 64 + i * 64, offset + 128 + i * 64);
    addrs.push('0x' + chunk.slice(-40));
  }
  return addrs;
}

function parseLog(log) {
  const sig = log.topics[0];
  if (sig === EVENT_SIGS.AgentRegistered) {
    return {
      type: 'AgentRegistered',
      agent: decodeAddress(log.topics[1].slice(2)),
      tokenId: log.topics[2] ? decodeUint256(log.topics[2].slice(2)) : '0',
      blockNumber: parseInt(log.blockNumber, 16),
      txHash: log.transactionHash,
    };
  }
  if (sig === EVENT_SIGS.QuorumFormed) {
    return {
      type: 'QuorumFormed',
      quorum: decodeAddress(log.topics[1].slice(2)),
      agents: log.data && log.data !== '0x' ? decodeAddressArray(log.data) : [],
      blockNumber: parseInt(log.blockNumber, 16),
      txHash: log.transactionHash,
    };
  }
  if (sig === EVENT_SIGS.BondingCurveDeployed) {
    return {
      type: 'BondingCurveDeployed',
      curve:  decodeAddress(log.topics[1].slice(2)),
      quorum: log.topics[2] ? decodeAddress(log.topics[2].slice(2)) : null,
      blockNumber: parseInt(log.blockNumber, 16),
      txHash: log.transactionHash,
    };
  }
  if (sig === EVENT_SIGS.ReputationUpdated) {
    return {
      type: 'ReputationUpdated',
      agent:    decodeAddress(log.topics[1].slice(2)),
      newScore: log.data && log.data !== '0x' ? decodeUint256(log.data.slice(2)) : '0',
      blockNumber: parseInt(log.blockNumber, 16),
      txHash: log.transactionHash,
    };
  }
  return null;
}

async function vendureRequest(apiUrl, token, query, variables) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error('[indexer] Vendure errors:', JSON.stringify(json.errors));
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

const GQL_CREATE_AGENT = `
  mutation CreateAgentProfile($input: CreateAgentProfileInput!) {
    createAgentProfile(input: $input) { id name walletAddress }
  }
`;

const GQL_CREATE_COLLAB = `
  mutation CreateCollaboration($input: CreateCollaborationInput!) {
    createCollaboration(input: $input) { id quorumAddress status }
  }
`;

const GQL_UPDATE_CURVE = `
  mutation UpdateCollaborationBondingCurve($quorumAddress: String!, $bondingCurve: String!) {
    updateCollaborationBondingCurve(quorumAddress: $quorumAddress, bondingCurve: $bondingCurve) {
      id bondingCurve
    }
  }
`;

const GQL_UPDATE_REPUTATION = `
  mutation UpdateAgentReputation($walletAddress: String!, $reputationScore: Int!) {
    updateAgentReputation(walletAddress: $walletAddress, reputationScore: $reputationScore) {
      id reputationScore
    }
  }
`;

async function processEvent(event, env) {
  const { VENDURE_API_URL, VENDURE_AUTH_TOKEN } = env;
  try {
    switch (event.type) {
      case 'AgentRegistered':
        console.log('[indexer] AgentRegistered:', event.agent, 'tokenId=' + event.tokenId);
        await vendureRequest(VENDURE_API_URL, VENDURE_AUTH_TOKEN, GQL_CREATE_AGENT, {
          input: {
            name: 'Agent ' + event.agent.slice(0, 8),
            walletAddress: event.agent,
            chainId: 8453,
            capabilities: [],
            onChainTokenId: event.tokenId,
            txHash: event.txHash,
          },
        });
        break;
      case 'QuorumFormed':
        console.log('[indexer] QuorumFormed:', event.quorum, 'agents=' + event.agents.length);
        await vendureRequest(VENDURE_API_URL, VENDURE_AUTH_TOKEN, GQL_CREATE_COLLAB, {
          input: {
            quorumAddress: event.quorum,
            agentWalletAddresses: event.agents,
            status: 'forming',
            txHash: event.txHash,
          },
        });
        break;
      case 'BondingCurveDeployed':
        console.log('[indexer] BondingCurveDeployed: curve=' + event.curve);
        if (event.quorum) {
          await vendureRequest(VENDURE_API_URL, VENDURE_AUTH_TOKEN, GQL_UPDATE_CURVE, {
            quorumAddress: event.quorum,
            bondingCurve: event.curve,
          });
        }
        break;
      case 'ReputationUpdated': {
        const score = Math.min(100, Math.max(0, Number(event.newScore)));
        console.log('[indexer] ReputationUpdated:', event.agent, 'score=' + score);
        await vendureRequest(VENDURE_API_URL, VENDURE_AUTH_TOKEN, GQL_UPDATE_REPUTATION, {
          walletAddress: event.agent,
          reputationScore: score,
        });
        break;
      }
      default:
        console.warn('[indexer] Unknown event type:', event.type);
    }
  } catch (err) {
    console.error('[indexer] Failed ' + event.type + ' block=' + event.blockNumber + ':', err.message);
  }
}

export default {
  async scheduled(event, env, ctx) {
    const { BASE_RPC_URL, INDEXER_STATE } = env;
    if (!BASE_RPC_URL)  throw new Error('BASE_RPC_URL env var not set');
    if (!INDEXER_STATE) throw new Error('INDEXER_STATE KV binding missing');

    const latestBlock      = await getLatestBlock(BASE_RPC_URL);
    const lastProcessedRaw = await INDEXER_STATE.get('lastProcessedBlock');
    const lastProcessed    = lastProcessedRaw ? parseInt(lastProcessedRaw, 10) : latestBlock - 100;

    if (lastProcessed >= latestBlock) {
      console.log('[indexer] Up to date at block ' + latestBlock);
      return;
    }

    const CHUNK = 500;
    let fromBlock = lastProcessed + 1;

    while (fromBlock <= latestBlock) {
      const toBlock = Math.min(fromBlock + CHUNK - 1, latestBlock);
      console.log('[indexer] Scanning ' + fromBlock + '-' + toBlock);

      const ZERO = '0x0000000000000000000000000000000000000000';
      const addresses = [env.AGENT_QUORUM_ADDRESS, env.BONDING_CURVE_FACTORY_ADDRESS]
        .filter(a => a && a !== ZERO);

      const logs = addresses.length > 0
        ? await getLogs(BASE_RPC_URL, fromBlock, toBlock, addresses, [Object.values(EVENT_SIGS)])
        : [];

      console.log('[indexer] ' + logs.length + ' events in range');
      for (const log of logs) {
        const parsed = parseLog(log);
        if (parsed) await processEvent(parsed, env);
      }

      await INDEXER_STATE.put('lastProcessedBlock', String(toBlock));
      fromBlock = toBlock + 1;
    }
    console.log('[indexer] Done, processed to block ' + latestBlock);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      const last = await env.INDEXER_STATE?.get('lastProcessedBlock') || 'unknown';
      return new Response(JSON.stringify({ status: 'ok', lastProcessedBlock: last }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const secret = request.headers.get('X-Indexer-Secret');
      if (secret !== env.INDEXER_SECRET) return new Response('Unauthorized', { status: 401 });
      ctx.waitUntil(this.scheduled({}, env, ctx));
      return new Response(JSON.stringify({ triggered: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Headless Markets Event Indexer', { status: 200 });
  },
};