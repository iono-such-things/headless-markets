// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentQuorum
 * @notice Manages agent team formation and unanimous consensus voting for token launches
 * @dev Implements Stage 2: Quorum - 3-5 agents must reach unanimous consensus
 */
contract AgentQuorum {
    
    // ============ Structs ============
    
    struct Proposal {
        uint256 proposalId;
        address proposer;
        string tokenName;
        string tokenSymbol;
        string description;
        address[] quorumMembers; // 3-5 agents
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteChoice; // true = yes, false = no
        uint256 yesVotes;
        uint256 noVotes;
        uint256 createdAt;
        uint256 votingDeadline;
        ProposalStatus status;
    }
    
    enum ProposalStatus {
        Active,      // Voting in progress
        Passed,      // Unanimous yes votes
        Failed,      // Any no vote or deadline passed
        Executed     // Token launched
    }
    
    // ============ State Variables ============
    
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    
    // Agent registry - tracks verified agents
    mapping(address => bool) public verifiedAgents;
    mapping(address => uint256) public agentReputation; // Track successful launches
    
    uint256 public constant MIN_QUORUM_SIZE = 3;
    uint256 public constant MAX_QUORUM_SIZE = 5;
    uint256 public constant VOTING_PERIOD = 7 days;
    
    address public admin;
    address public bondingCurveFactory; // Set after BondingCurveFactory deployment
    
    // ============ Events ============
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address[] quorumMembers,
        string tokenName,
        string tokenSymbol
    );
    
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool vote
    );
    
    event ProposalPassed(
        uint256 indexed proposalId,
        address[] quorumMembers
    );
    
    event ProposalFailed(
        uint256 indexed proposalId,
        string reason
    );
    
    event AgentVerified(address indexed agent);
    event AgentUnverified(address indexed agent);
    
    // ============ Modifiers ============
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    modifier onlyVerifiedAgent() {
        require(verifiedAgents[msg.sender], "Not verified agent");
        _;
    }
    
    modifier proposalExists(uint256 proposalId) {
        require(proposalId < proposalCount, "Proposal does not exist");
        _;
    }
    
    modifier proposalActive(uint256 proposalId) {
        require(proposals[proposalId].status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp <= proposals[proposalId].votingDeadline, "Voting period ended");
        _;
    }
    
    // ============ Constructor ============
    
    constructor() {
        admin = msg.sender;
    }
    
    // ============ Admin Functions ============
    
    function setBondingCurveFactory(address _factory) external onlyAdmin {
        require(_factory != address(0), "Invalid factory address");
        bondingCurveFactory = _factory;
    }
    
    function verifyAgent(address agent) external onlyAdmin {
        require(!verifiedAgents[agent], "Agent already verified");
        verifiedAgents[agent] = true;
        emit AgentVerified(agent);
    }
    
    function unverifyAgent(address agent) external onlyAdmin {
        require(verifiedAgents[agent], "Agent not verified");
        verifiedAgents[agent] = false;
        emit AgentUnverified(agent);
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Create a new token launch proposal with agent quorum
     * @param tokenName Name of the token to launch
     * @param tokenSymbol Symbol of the token
     * @param description Description of the agent team and token purpose
     * @param quorumMembers Array of 3-5 verified agent addresses
     */
    function createProposal(
        string memory tokenName,
        string memory tokenSymbol,
        string memory description,
        address[] memory quorumMembers
    ) external onlyVerifiedAgent returns (uint256) {
        require(quorumMembers.length >= MIN_QUORUM_SIZE, "Quorum too small");
        require(quorumMembers.length <= MAX_QUORUM_SIZE, "Quorum too large");
        
        // Verify all quorum members are verified agents
        for (uint256 i = 0; i < quorumMembers.length; i++) {
            require(verifiedAgents[quorumMembers[i]], "Invalid quorum member");
            
            // Check for duplicates
            for (uint256 j = i + 1; j < quorumMembers.length; j++) {
                require(quorumMembers[i] != quorumMembers[j], "Duplicate quorum member");
            }
        }
        
        // Proposer must be in quorum
        bool proposerInQuorum = false;
        for (uint256 i = 0; i < quorumMembers.length; i++) {
            if (quorumMembers[i] == msg.sender) {
                proposerInQuorum = true;
                break;
            }
        }
        require(proposerInQuorum, "Proposer must be in quorum");
        
        uint256 proposalId = proposalCount++;
        Proposal storage p = proposals[proposalId];
        
        p.proposalId = proposalId;
        p.proposer = msg.sender;
        p.tokenName = tokenName;
        p.tokenSymbol = tokenSymbol;
        p.description = description;
        p.quorumMembers = quorumMembers;
        p.createdAt = block.timestamp;
        p.votingDeadline = block.timestamp + VOTING_PERIOD;
        p.status = ProposalStatus.Active;
        
        emit ProposalCreated(proposalId, msg.sender, quorumMembers, tokenName, tokenSymbol);
        
        return proposalId;
    }
    
    /**
     * @notice Vote on a proposal (quorum members only)
     * @param proposalId ID of the proposal
     * @param vote true for yes, false for no
     */
    function castVote(uint256 proposalId, bool vote) 
        external 
        proposalExists(proposalId)
        proposalActive(proposalId)
    {
        Proposal storage p = proposals[proposalId];
        
        // Check voter is in quorum
        bool isQuorumMember = false;
        for (uint256 i = 0; i < p.quorumMembers.length; i++) {
            if (p.quorumMembers[i] == msg.sender) {
                isQuorumMember = true;
                break;
            }
        }
        require(isQuorumMember, "Not a quorum member");
        require(!p.hasVoted[msg.sender], "Already voted");
        
        p.hasVoted[msg.sender] = true;
        p.voteChoice[msg.sender] = vote;
        
        if (vote) {
            p.yesVotes++;
        } else {
            p.noVotes++;
        }
        
        emit VoteCast(proposalId, msg.sender, vote);
        
        // Check if proposal should be finalized
        _checkProposalStatus(proposalId);
    }
    
    /**
     * @notice Check and update proposal status based on votes
     */
    function _checkProposalStatus(uint256 proposalId) internal {
        Proposal storage p = proposals[proposalId];
        
        // If any no vote, proposal fails immediately
        if (p.noVotes > 0) {
            p.status = ProposalStatus.Failed;
            emit ProposalFailed(proposalId, "Received no vote");
            return;
        }
        
        // If all members voted yes, proposal passes (unanimous consensus)
        if (p.yesVotes == p.quorumMembers.length) {
            p.status = ProposalStatus.Passed;
            emit ProposalPassed(proposalId, p.quorumMembers);
        }
    }
    
    /**
     * @notice Finalize expired proposals
     */
    function finalizeProposal(uint256 proposalId) 
        external 
        proposalExists(proposalId)
    {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp > p.votingDeadline, "Voting period not ended");
        
        // If deadline passed and not unanimous, it fails
        if (p.yesVotes != p.quorumMembers.length) {
            p.status = ProposalStatus.Failed;
            emit ProposalFailed(proposalId, "Did not reach unanimous consensus");
        }
    }
    
    /**
     * @notice Execute a passed proposal and trigger token launch
     * @dev Called by BondingCurveFactory after creating token
     */
    function executeProposal(uint256 proposalId) external {
        require(msg.sender == bondingCurveFactory, "Only factory");
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Passed, "Proposal not passed");
        
        p.status = ProposalStatus.Executed;
        
        // Increase reputation for all quorum members
        for (uint256 i = 0; i < p.quorumMembers.length; i++) {
            agentReputation[p.quorumMembers[i]]++;
        }
    }
    
    // ============ View Functions ============
    
    function getProposal(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId)
        returns (
            address proposer,
            string memory tokenName,
            string memory tokenSymbol,
            string memory description,
            address[] memory quorumMembers,
            uint256 yesVotes,
            uint256 noVotes,
            uint256 votingDeadline,
            ProposalStatus status
        )
    {
        Proposal storage p = proposals[proposalId];
        return (
            p.proposer,
            p.tokenName,
            p.tokenSymbol,
            p.description,
            p.quorumMembers,
            p.yesVotes,
            p.noVotes,
            p.votingDeadline,
            p.status
        );
    }
    
    function hasVoted(uint256 proposalId, address voter) 
        external 
        view 
        proposalExists(proposalId)
        returns (bool)
    {
        return proposals[proposalId].hasVoted[voter];
    }
    
    function getVote(uint256 proposalId, address voter) 
        external 
        view 
        proposalExists(proposalId)
        returns (bool)
    {
        require(proposals[proposalId].hasVoted[voter], "Has not voted");
        return proposals[proposalId].voteChoice[voter];
    }
    
    function isQuorumMember(uint256 proposalId, address agent) 
        external 
        view 
        proposalExists(proposalId)
        returns (bool)
    {
        Proposal storage p = proposals[proposalId];
        for (uint256 i = 0; i < p.quorumMembers.length; i++) {
            if (p.quorumMembers[i] == agent) {
                return true;
            }
        }
        return false;
    }
}
