// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BondingCurve.sol";
import "./AgentQuorum.sol";

/**
 * @title BondingCurveFactory
 * @notice Factory for creating bonding curve tokens after quorum approval
 * @dev Orchestrates the entire launch process from proposal to token creation
 */
contract BondingCurveFactory {
    
    // ============ State Variables ============
    
    AgentQuorum public quorumContract;
    address public platformFeeRecipient;
    address public uniswapV2Router;
    
    // Track all launched tokens
    mapping(uint256 => address) public proposalToToken; // proposalId => token address
    address[] public allTokens;
    
    address public admin;
    
    // ============ Events ============
    
    event TokenLaunched(
        uint256 indexed proposalId,
        address indexed tokenAddress,
        string name,
        string symbol,
        address[] quorumMembers
    );
    
    // ============ Modifiers ============
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        address _quorumContract,
        address _platformFeeRecipient,
        address _uniswapV2Router
    ) {
        require(_quorumContract != address(0), "Invalid quorum contract");
        require(_platformFeeRecipient != address(0), "Invalid fee recipient");
        require(_uniswapV2Router != address(0), "Invalid router");
        
        quorumContract = AgentQuorum(_quorumContract);
        platformFeeRecipient = _platformFeeRecipient;
        uniswapV2Router = _uniswapV2Router;
        admin = msg.sender;
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Launch a bonding curve token after quorum approval
     * @param proposalId The approved quorum proposal ID
     */
    function launchToken(uint256 proposalId) external returns (address) {
        // Get proposal details
        (
            ,
            string memory tokenName,
            string memory tokenSymbol,
            ,
            address[] memory quorumMembers,
            ,
            ,
            ,
            AgentQuorum.ProposalStatus status
        ) = quorumContract.getProposal(proposalId);
        
        require(status == AgentQuorum.ProposalStatus.Passed, "Proposal not passed");
        require(proposalToToken[proposalId] == address(0), "Already launched");
        
        // Create new bonding curve token
        BondingCurveToken token = new BondingCurveToken(
            tokenName,
            tokenSymbol,
            quorumMembers,
            platformFeeRecipient,
            uniswapV2Router,
            proposalId
        );
        
        // Record token
        proposalToToken[proposalId] = address(token);
        allTokens.push(address(token));
        
        // Mark proposal as executed in quorum contract
        quorumContract.executeProposal(proposalId);
        
        emit TokenLaunched(proposalId, address(token), tokenName, tokenSymbol, quorumMembers);
        
        return address(token);
    }
    
    // ============ Admin Functions ============
    
    function updatePlatformFeeRecipient(address _newRecipient) external onlyAdmin {
        require(_newRecipient != address(0), "Invalid address");
        platformFeeRecipient = _newRecipient;
    }
    
    function updateUniswapRouter(address _newRouter) external onlyAdmin {
        require(_newRouter != address(0), "Invalid address");
        uniswapV2Router = _newRouter;
    }
    
    // ============ View Functions ============
    
    function getTokenByProposal(uint256 proposalId) external view returns (address) {
        return proposalToToken[proposalId];
    }
    
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }
    
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }
    
    function getTokenDetails(address tokenAddress) external view returns (
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint256 price,
        uint256 ethRaised,
        bool graduated
    ) {
        BondingCurveToken token = BondingCurveToken(payable(tokenAddress));
        
        (uint256 currentPrice, uint256 supply, uint256 raised, , bool isGraduated, ) = token.getMarketStats();
        
        return (
            token.name(),
            token.symbol(),
            supply,
            currentPrice,
            raised,
            isGraduated
        );
    }
}
