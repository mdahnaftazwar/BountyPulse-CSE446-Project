// frontend/js/config.js

// ⚠️ Update this every time you redeploy locally (forge create output)
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const CONTRACT_ABI = [
    // --- Public state / constants ---
    "function arbiter() view returns (address)",
    "function bountyCount() view returns (uint256)",
    "function PLATFORM_FEE_PERCENT() view returns (uint256)",

    // --- Public mapping getters ---
    "function users(address) view returns (string name, uint8 role, string ipfsAvatarHash, uint256 reputationScore, bool isRegistered)",
    "function bounties(uint256) view returns (uint256 id, address client, uint256 maxBudget, string ipfsBountyDetailsHash, uint8 status, address chosenFreelancer, uint256 escrowAmount, string ipfsWorkFileHash)",
    "function hasBidded(uint256, address) view returns (bool)",
    "function withdrawableBalance(address) view returns (uint256)",

    // --- State-changing functions ---
    "function registerUser(string _name, uint8 _role, string _ipfsAvatarHash)",
    "function postBounty(uint256 _maxBudget, string _ipfsBountyDetailsHash) returns (uint256)",
    "function submitBid(uint256 _bountyId, uint256 _askingPrice)",
    "function fundEscrow(uint256 _bountyId, address _freelancer) payable",
    "function submitWork(uint256 _bountyId, string _ipfsWorkFileHash)",
    "function approveWork(uint256 _bountyId)",
    "function raiseDispute(uint256 _bountyId)",
    "function resolveDispute(uint256 _bountyId, bool _freelancerFault)",
    "function claimFunds()",

    // --- Convenience view functions (return everything in one call) ---
    "function getBountyBids(uint256 _bountyId) view returns (tuple(address freelancer, uint256 askingPrice)[])",
    "function getAllBounties() view returns (tuple(uint256 id, address client, uint256 maxBudget, string ipfsBountyDetailsHash, uint8 status, address chosenFreelancer, uint256 escrowAmount, string ipfsWorkFileHash)[])",
    "function getUser(address _userAddress) view returns (tuple(string name, uint8 role, string ipfsAvatarHash, uint256 reputationScore, bool isRegistered))",

    // --- Events (for Member 4's listeners, but you'll want them for testing too) ---
    "event UserRegistered(address indexed userAddress, string name, uint8 role, string ipfsAvatarHash, uint256 reputationScore)",
    "event BountyPosted(uint256 indexed bountyId, address indexed client, uint256 maxBudget, string ipfsBountyDetailsHash)",
    "event BidSubmitted(uint256 indexed bountyId, address indexed freelancer, uint256 askingPrice)",
    "event EscrowFunded(uint256 indexed bountyId, address indexed client, address indexed freelancer, uint256 escrowAmount, uint256 refundedExcess)",
    "event WorkSubmitted(uint256 indexed bountyId, address indexed freelancer, string ipfsWorkFileHash)",
    "event WorkApproved(uint256 indexed bountyId, address indexed client, address indexed freelancer, uint256 freelancerPayout, uint256 arbiterFee)",
    "event FundsClaimed(address indexed user, uint256 amount)",
    "event DisputeRaised(uint256 indexed bountyId, address indexed raisedBy)",
    "event DisputeResolved(uint256 indexed bountyId, bool freelancerFault, uint256 refundedClientAmount, uint256 freelancerPayout, uint256 arbiterFee)"
];

// Enum lookups — the contract returns these as plain integers, decode for display
const ROLE = { 0: "None", 1: "Client", 2: "Freelancer" };
const BOUNTY_STATUS = { 0: "Open", 1: "Locked", 2: "Resolved", 3: "Disputed" };
