-- Headless Markets Database Schema
-- PostgreSQL 15+
-- Supports: Agents, Quorums, Proposals, Markets, Trades, Reputation

-- ============================================
-- EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- AGENTS TABLE
-- ============================================

CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    avatar_url TEXT,
    website_url TEXT,
    twitter_handle VARCHAR(100),
    telegram_handle VARCHAR(100),
    
    -- Capabilities stored as JSON array
    capabilities JSONB DEFAULT '[]'::jsonb,
    
    -- Reputation metrics
    reputation_score INTEGER DEFAULT 0,
    total_proposals_created INTEGER DEFAULT 0,
    total_votes_cast INTEGER DEFAULT 0,
    total_markets_launched INTEGER DEFAULT 0,
    total_volume_generated NUMERIC(78, 0) DEFAULT 0,
    successful_graduations INTEGER DEFAULT 0,
    
    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    verified_by VARCHAR(42),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT wallet_address_format CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

CREATE INDEX idx_agents_wallet ON agents(wallet_address);
CREATE INDEX idx_agents_verified ON agents(verified) WHERE verified = TRUE;
CREATE INDEX idx_agents_reputation ON agents(reputation_score DESC);
CREATE INDEX idx_agents_capabilities ON agents USING gin(capabilities);

-- ============================================
-- QUORUMS TABLE
-- ============================================

CREATE TABLE quorums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id BIGINT UNIQUE NOT NULL,
    
    -- Token details
    token_name VARCHAR(100) NOT NULL,
    token_symbol VARCHAR(10) NOT NULL,
    description TEXT,
    
    -- Proposal info
    proposer_address VARCHAR(42) NOT NULL REFERENCES agents(wallet_address),
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    -- Possible values: ACTIVE, PASSED, FAILED, EXECUTED
    
    -- Voting metrics
    quorum_size INTEGER NOT NULL,
    yes_votes INTEGER DEFAULT 0,
    no_votes INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL,
    voting_deadline TIMESTAMP NOT NULL,
    finalized_at TIMESTAMP,
    executed_at TIMESTAMP,
    
    -- On-chain reference
    tx_hash VARCHAR(66),
    block_number BIGINT,
    
    CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'PASSED', 'FAILED', 'EXECUTED')),
    CONSTRAINT valid_quorum_size CHECK (quorum_size >= 3 AND quorum_size <= 5)
);

CREATE INDEX idx_quorums_proposal_id ON quorums(proposal_id);
CREATE INDEX idx_quorums_proposer ON quorums(proposer_address);
CREATE INDEX idx_quorums_status ON quorums(status);
CREATE INDEX idx_quorums_created_at ON quorums(created_at DESC);

-- ============================================
-- QUORUM MEMBERS TABLE
-- ============================================

CREATE TABLE quorum_members (
    quorum_id UUID NOT NULL REFERENCES quorums(id) ON DELETE CASCADE,
    agent_address VARCHAR(42) NOT NULL REFERENCES agents(wallet_address),
    
    -- Voting data
    has_voted BOOLEAN DEFAULT FALSE,
    vote_choice BOOLEAN, -- TRUE = yes, FALSE = no, NULL = not voted
    voted_at TIMESTAMP,
    vote_tx_hash VARCHAR(66),
    
    -- Member order (for UI display)
    member_index INTEGER NOT NULL,
    
    PRIMARY KEY (quorum_id, agent_address),
    CONSTRAINT valid_member_index CHECK (member_index >= 0 AND member_index < 5)
);

CREATE INDEX idx_quorum_members_agent ON quorum_members(agent_address);
CREATE INDEX idx_quorum_members_voted ON quorum_members(has_voted);

-- ============================================
-- MARKETS TABLE
-- ============================================

CREATE TABLE markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Contract addresses
    bonding_curve_address VARCHAR(42) UNIQUE NOT NULL,
    token_address VARCHAR(42) UNIQUE NOT NULL,
    
    -- Link to proposal
    proposal_id BIGINT REFERENCES quorums(proposal_id),
    quorum_id UUID REFERENCES quorums(id),
    
    -- Token details
    token_name VARCHAR(100) NOT NULL,
    token_symbol VARCHAR(10) NOT NULL,
    total_supply NUMERIC(78, 0) NOT NULL,
    
    -- Market state
    current_supply NUMERIC(78, 0) DEFAULT 0,
    total_raised NUMERIC(78, 0) DEFAULT 0,
    current_price NUMERIC(78, 0) DEFAULT 0,
    
    -- Fee configuration (basis points, e.g., 300 = 3%)
    platform_fee_bps INTEGER DEFAULT 3000, -- 30%
    liquidity_fee_bps INTEGER DEFAULT 6000, -- 60%
    agent_fee_bps INTEGER DEFAULT 1000, -- 10%
    
    -- Graduation state
    graduated BOOLEAN DEFAULT FALSE,
    graduation_threshold NUMERIC(78, 0), -- 10 ETH in wei
    uniswap_pool_address VARCHAR(42),
    graduated_at TIMESTAMP,
    graduation_tx_hash VARCHAR(66),
    
    -- Platform fees collected
    platform_fees_collected NUMERIC(78, 0) DEFAULT 0,
    agent_fees_collected NUMERIC(78, 0) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_trade_at TIMESTAMP,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT valid_supply CHECK (current_supply <= total_supply),
    CONSTRAINT valid_fees CHECK (
        platform_fee_bps + liquidity_fee_bps + agent_fee_bps = 10000
    )
);

CREATE INDEX idx_markets_bonding_curve ON markets(bonding_curve_address);
CREATE INDEX idx_markets_token ON markets(token_address);
CREATE INDEX idx_markets_proposal ON markets(proposal_id);
CREATE INDEX idx_markets_graduated ON markets(graduated);
CREATE INDEX idx_markets_created_at ON markets(created_at DESC);
CREATE INDEX idx_markets_volume ON markets(total_raised DESC);

-- ============================================
-- TRADES TABLE
-- ============================================

CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id UUID NOT NULL REFERENCES markets(id),
    
    -- Trade details
    trader_address VARCHAR(42) NOT NULL,
    is_buy BOOLEAN NOT NULL, -- TRUE = buy, FALSE = sell
    
    -- Amounts
    token_amount NUMERIC(78, 0) NOT NULL,
    eth_amount NUMERIC(78, 0) NOT NULL,
    price_per_token NUMERIC(78, 0) NOT NULL,
    
    -- Fees paid
    platform_fee NUMERIC(78, 0) DEFAULT 0,
    liquidity_fee NUMERIC(78, 0) DEFAULT 0,
    agent_fee NUMERIC(78, 0) DEFAULT 0,
    
    -- Market state after trade
    supply_after NUMERIC(78, 0),
    price_after NUMERIC(78, 0),
    
    -- On-chain reference
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    block_number BIGINT NOT NULL,
    log_index INTEGER NOT NULL,
    
    -- Timestamp
    timestamp TIMESTAMP NOT NULL,
    
    CONSTRAINT positive_amounts CHECK (
        token_amount > 0 AND eth_amount > 0
    )
);

CREATE INDEX idx_trades_market ON trades(market_id);
CREATE INDEX idx_trades_trader ON trades(trader_address);
CREATE INDEX idx_trades_timestamp ON trades(timestamp DESC);
CREATE INDEX idx_trades_tx_hash ON trades(tx_hash);
CREATE INDEX idx_trades_block ON trades(block_number DESC);

-- ============================================
-- AGENT PARTNERSHIPS TABLE
-- ============================================

CREATE TABLE agent_partnerships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_a VARCHAR(42) NOT NULL REFERENCES agents(wallet_address),
    agent_b VARCHAR(42) NOT NULL REFERENCES agents(wallet_address),
    
    -- Partnership metrics
    total_quorums_together INTEGER DEFAULT 0,
    successful_launches INTEGER DEFAULT 0,
    total_volume_together NUMERIC(78, 0) DEFAULT 0,
    
    -- Compatibility score (0-100)
    compatibility_score INTEGER DEFAULT 0,
    
    -- Timestamps
    first_collaboration TIMESTAMP,
    last_collaboration TIMESTAMP,
    
    CONSTRAINT different_agents CHECK (agent_a < agent_b),
    CONSTRAINT valid_compatibility CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
    UNIQUE(agent_a, agent_b)
);

CREATE INDEX idx_partnerships_agent_a ON agent_partnerships(agent_a);
CREATE INDEX idx_partnerships_agent_b ON agent_partnerships(agent_b);
CREATE INDEX idx_partnerships_compatibility ON agent_partnerships(compatibility_score DESC);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_address VARCHAR(42) NOT NULL REFERENCES agents(wallet_address),
    
    -- Notification type
    type VARCHAR(50) NOT NULL,
    -- Types: QUORUM_INVITATION, VOTE_CAST, PROPOSAL_PASSED, PROPOSAL_FAILED,
    --        MARKET_LAUNCHED, TRADE_EXECUTED, GRADUATION_REACHED
    
    -- Notification content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Related entities
    related_quorum_id UUID REFERENCES quorums(id),
    related_market_id UUID REFERENCES markets(id),
    related_trade_id UUID REFERENCES trades(id),
    
    -- Read status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_address);
CREATE INDEX idx_notifications_unread ON notifications(recipient_address, is_read) 
    WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- INDEXER STATE TABLE
-- ============================================

CREATE TABLE indexer_state (
    id SERIAL PRIMARY KEY,
    contract_address VARCHAR(42) NOT NULL,
    contract_name VARCHAR(100) NOT NULL,
    
    -- Sync state
    last_synced_block BIGINT NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMP DEFAULT NOW(),
    
    -- Status
    is_syncing BOOLEAN DEFAULT FALSE,
    sync_error TEXT,
    
    UNIQUE(contract_address)
);

-- ============================================
-- VIEWS
-- ============================================

-- Agent leaderboard view
CREATE VIEW agent_leaderboard AS
SELECT 
    a.wallet_address,
    a.name,
    a.reputation_score,
    a.total_markets_launched,
    a.total_volume_generated,
    a.successful_graduations,
    COALESCE(partnership_count, 0) as total_partnerships,
    a.verified,
    a.created_at
FROM agents a
LEFT JOIN (
    SELECT agent_a as wallet, COUNT(*) as partnership_count
    FROM agent_partnerships
    GROUP BY agent_a
    UNION ALL
    SELECT agent_b as wallet, COUNT(*) as partnership_count
    FROM agent_partnerships
    GROUP BY agent_b
) p ON a.wallet_address = p.wallet
ORDER BY a.reputation_score DESC, a.total_volume_generated DESC;

-- Active markets view
CREATE VIEW active_markets AS
SELECT 
    m.*,
    q.proposer_address,
    q.quorum_size,
    COUNT(DISTINCT t.id) as trade_count,
    COUNT(DISTINCT t.trader_address) as unique_traders,
    EXTRACT(EPOCH FROM (NOW() - m.created_at)) as age_seconds
FROM markets m
LEFT JOIN quorums q ON m.quorum_id = q.id
LEFT JOIN trades t ON m.id = t.market_id
WHERE m.graduated = FALSE
GROUP BY m.id, q.proposer_address, q.quorum_size
ORDER BY m.last_trade_at DESC NULLS LAST;

-- Graduated markets view
CREATE VIEW graduated_markets AS
SELECT 
    m.*,
    q.proposer_address,
    q.quorum_size,
    COUNT(DISTINCT t.id) as total_trades,
    SUM(CASE WHEN t.is_buy THEN t.eth_amount ELSE 0 END) as total_buy_volume,
    SUM(CASE WHEN NOT t.is_buy THEN t.eth_amount ELSE 0 END) as total_sell_volume
FROM markets m
LEFT JOIN quorums q ON m.quorum_id = q.id
LEFT JOIN trades t ON m.id = t.market_id
WHERE m.graduated = TRUE
GROUP BY m.id, q.proposer_address, q.quorum_size
ORDER BY m.graduated_at DESC;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update agent reputation based on actions
CREATE OR REPLACE FUNCTION update_agent_reputation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Market launched: +100 reputation
        IF TG_TABLE_NAME = 'markets' THEN
            UPDATE agents
            SET reputation_score = reputation_score + 100,
                total_markets_launched = total_markets_launched + 1,
                last_activity_at = NOW()
            WHERE wallet_address IN (
                SELECT agent_address 
                FROM quorum_members 
                WHERE quorum_id = NEW.quorum_id
            );
        END IF;
        
        -- Vote cast: +10 reputation
        IF TG_TABLE_NAME = 'quorum_members' AND NEW.has_voted THEN
            UPDATE agents
            SET reputation_score = reputation_score + 10,
                total_votes_cast = total_votes_cast + 1,
                last_activity_at = NOW()
            WHERE wallet_address = NEW.agent_address;
        END IF;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        -- Graduation reached: +500 reputation
        IF TG_TABLE_NAME = 'markets' AND NEW.graduated AND NOT OLD.graduated THEN
            UPDATE agents
            SET reputation_score = reputation_score + 500,
                successful_graduations = successful_graduations + 1
            WHERE wallet_address IN (
                SELECT agent_address 
                FROM quorum_members 
                WHERE quorum_id = NEW.quorum_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for reputation updates
CREATE TRIGGER trigger_update_reputation_markets
AFTER INSERT OR UPDATE ON markets
FOR EACH ROW EXECUTE FUNCTION update_agent_reputation();

CREATE TRIGGER trigger_update_reputation_votes
AFTER INSERT OR UPDATE ON quorum_members
FOR EACH ROW EXECUTE FUNCTION update_agent_reputation();

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agents_timestamp
BEFORE UPDATE ON agents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_markets_timestamp
BEFORE UPDATE ON markets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert admin as first verified agent (update address as needed)
INSERT INTO agents (wallet_address, name, description, verified, verified_at)
VALUES (
    '0x0000000000000000000000000000000000000000',
    'Platform Admin',
    'Headless Markets platform administrator',
    TRUE,
    NOW()
) ON CONFLICT (wallet_address) DO NOTHING;

-- Initialize indexer state for contracts (addresses will be updated after deployment)
INSERT INTO indexer_state (contract_address, contract_name, last_synced_block)
VALUES 
    ('0x0000000000000000000000000000000000000000', 'AgentQuorum', 0),
    ('0x0000000000000000000000000000000000000000', 'BondingCurveFactory', 0)
ON CONFLICT (contract_address) DO NOTHING;

-- ============================================
-- GRANTS (adjust as needed for your setup)
-- ============================================

-- Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO headless_markets_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO headless_markets_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO headless_markets_app;
