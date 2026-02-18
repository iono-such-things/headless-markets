-- Migration: 001_initial_schema
-- Description: Create initial database schema for Headless Markets
-- Date: 2026-02-17

BEGIN;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    avatar_url TEXT,
    website_url TEXT,
    twitter_handle VARCHAR(100),
    telegram_handle VARCHAR(100),
    capabilities JSONB DEFAULT '[]'::jsonb,
    reputation_score INTEGER DEFAULT 0,
    total_proposals_created INTEGER DEFAULT 0,
    total_votes_cast INTEGER DEFAULT 0,
    total_markets_launched INTEGER DEFAULT 0,
    total_volume_generated NUMERIC(78, 0) DEFAULT 0,
    successful_graduations INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    verified_by VARCHAR(42),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT wallet_address_format CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- Create indexes for agents
CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agents_verified ON agents(verified) WHERE verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_agents_reputation ON agents(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_agents_capabilities ON agents USING gin(capabilities);

-- Create quorums table
CREATE TABLE IF NOT EXISTS quorums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id BIGINT UNIQUE NOT NULL,
    token_name VARCHAR(100) NOT NULL,
    token_symbol VARCHAR(10) NOT NULL,
    description TEXT,
    proposer_address VARCHAR(42) NOT NULL REFERENCES agents(wallet_address),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    quorum_size INTEGER NOT NULL,
    yes_votes INTEGER DEFAULT 0,
    no_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    voting_deadline TIMESTAMP NOT NULL,
    finalized_at TIMESTAMP,
    executed_at TIMESTAMP,
    tx_hash VARCHAR(66),
    block_number BIGINT,
    CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'PASSED', 'FAILED', 'EXECUTED')),
    CONSTRAINT valid_quorum_size CHECK (quorum_size >= 3 AND quorum_size <= 5)
);

-- Create indexes for quorums
CREATE INDEX IF NOT EXISTS idx_quorums_proposal_id ON quorums(proposal_id);
CREATE INDEX IF NOT EXISTS idx_quorums_proposer ON quorums(proposer_address);
CREATE INDEX IF NOT EXISTS idx_quorums_status ON quorums(status);
CREATE INDEX IF NOT EXISTS idx_quorums_created_at ON quorums(created_at DESC);

-- Create quorum_members table
CREATE TABLE IF NOT EXISTS quorum_members (
    quorum_id UUID NOT NULL REFERENCES quorums(id) ON DELETE CASCADE,
    agent_address VARCHAR(42) NOT NULL REFERENCES agents(wallet_address),
    has_voted BOOLEAN DEFAULT FALSE,
    vote_choice BOOLEAN,
    voted_at TIMESTAMP,
    vote_tx_hash VARCHAR(66),
    member_index INTEGER NOT NULL,
    PRIMARY KEY (quorum_id, agent_address),
    CONSTRAINT valid_member_index CHECK (member_index >= 0 AND member_index < 5)
);

CREATE INDEX IF NOT EXISTS idx_quorum_members_agent ON quorum_members(agent_address);
CREATE INDEX IF NOT EXISTS idx_quorum_members_voted ON quorum_members(has_voted);

-- Create markets table
CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bonding_curve_address VARCHAR(42) UNIQUE NOT NULL,
    token_address VARCHAR(42) UNIQUE NOT NULL,
    proposal_id BIGINT REFERENCES quorums(proposal_id),
    quorum_id UUID REFERENCES quorums(id),
    token_name VARCHAR(100) NOT NULL,
    token_symbol VARCHAR(10) NOT NULL,
    total_supply NUMERIC(78, 0) NOT NULL,
    current_supply NUMERIC(78, 0) DEFAULT 0,
    total_raised NUMERIC(78, 0) DEFAULT 0,
    current_price NUMERIC(78, 0) DEFAULT 0,
    platform_fee_bps INTEGER DEFAULT 3000,
    liquidity_fee_bps INTEGER DEFAULT 6000,
    agent_fee_bps INTEGER DEFAULT 1000,
    graduated BOOLEAN DEFAULT FALSE,
    graduation_threshold NUMERIC(78, 0),
    uniswap_pool_address VARCHAR(42),
    graduated_at TIMESTAMP,
    graduation_tx_hash VARCHAR(66),
    platform_fees_collected NUMERIC(78, 0) DEFAULT 0,
    agent_fees_collected NUMERIC(78, 0) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_trade_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT valid_supply CHECK (current_supply <= total_supply),
    CONSTRAINT valid_fees CHECK (platform_fee_bps + liquidity_fee_bps + agent_fee_bps = 10000)
);

CREATE INDEX IF NOT EXISTS idx_markets_bonding_curve ON markets(bonding_curve_address);
CREATE INDEX IF NOT EXISTS idx_markets_token ON markets(token_address);
CREATE INDEX IF NOT EXISTS idx_markets_proposal ON markets(proposal_id);
CREATE INDEX IF NOT EXISTS idx_markets_graduated ON markets(graduated);
CREATE INDEX IF NOT EXISTS idx_markets_created_at ON markets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_markets_volume ON markets(total_raised DESC);

-- Create trades table
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id UUID NOT NULL REFERENCES markets(id),
    trader_address VARCHAR(42) NOT NULL,
    is_buy BOOLEAN NOT NULL,
    token_amount NUMERIC(78, 0) NOT NULL,
    eth_amount NUMERIC(78, 0) NOT NULL,
    price_per_token NUMERIC(78, 0) NOT NULL,
    platform_fee NUMERIC(78, 0) DEFAULT 0,
    liquidity_fee NUMERIC(78, 0) DEFAULT 0,
    agent_fee NUMERIC(78, 0) DEFAULT 0,
    supply_after NUMERIC(78, 0),
    price_after NUMERIC(78, 0),
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    block_number BIGINT NOT NULL,
    log_index INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    CONSTRAINT positive_amounts CHECK (token_amount > 0 AND eth_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_trader ON trades(trader_address);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_tx_hash ON trades(tx_hash);
CREATE INDEX IF NOT EXISTS idx_trades_block ON trades(block_number DESC);

-- Create agent_partnerships table
CREATE TABLE IF NOT EXISTS agent_partnerships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_a VARCHAR(42) NOT NULL REFERENCES agents(wallet_address),
    agent_b VARCHAR(42) NOT NULL REFERENCES agents(wallet_address),
    total_quorums_together INTEGER DEFAULT 0,
    successful_launches INTEGER DEFAULT 0,
    total_volume_together NUMERIC(78, 0) DEFAULT 0,
    compatibility_score INTEGER DEFAULT 0,
    first_collaboration TIMESTAMP,
    last_collaboration TIMESTAMP,
    CONSTRAINT different_agents CHECK (agent_a < agent_b),
    CONSTRAINT valid_compatibility CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
    UNIQUE(agent_a, agent_b)
);

CREATE INDEX IF NOT EXISTS idx_partnerships_agent_a ON agent_partnerships(agent_a);
CREATE INDEX IF NOT EXISTS idx_partnerships_agent_b ON agent_partnerships(agent_b);
CREATE INDEX IF NOT EXISTS idx_partnerships_compatibility ON agent_partnerships(compatibility_score DESC);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_address VARCHAR(42) NOT NULL REFERENCES agents(wallet_address),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_quorum_id UUID REFERENCES quorums(id),
    related_market_id UUID REFERENCES markets(id),
    related_trade_id UUID REFERENCES trades(id),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_address);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_address, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Create indexer_state table
CREATE TABLE IF NOT EXISTS indexer_state (
    id SERIAL PRIMARY KEY,
    contract_address VARCHAR(42) NOT NULL,
    contract_name VARCHAR(100) NOT NULL,
    last_synced_block BIGINT NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMP DEFAULT NOW(),
    is_syncing BOOLEAN DEFAULT FALSE,
    sync_error TEXT,
    UNIQUE(contract_address)
);

COMMIT;
