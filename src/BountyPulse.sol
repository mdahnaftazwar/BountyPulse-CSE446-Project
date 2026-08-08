// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BountyPulse {
    // Enum and structs

    enum Role {
        None,
        Client,
        Freelancer
    }
    enum BountyStatus {
        Open,
        Locked,
        Resolved,
        Disputed
    }

    struct User {
        string name;
        Role role;
        string ipfsAvatarHash;
        uint256 reputationScore;
        bool isRegistered;
    }

    struct Bid {
        address freelancer;
        uint256 askingPrice;
    }

    struct Bounty {
        uint256 id;
        address client;
        uint256 maxBudget;
        string ipfsBountyDetailsHash;
        BountyStatus status;
        address chosenFreelancer;
        uint256 escrowAmount;
        string ipfsWorkFileHash;
    }

    // State Variables

    address public immutable arbiter;
    uint256 public bountyCount;

    // Platform Fee Percentage (2%)
    uint256 public constant PLATFORM_FEE_PERCENT = 2;

    // Mappings
    mapping(address => User) public users;
    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => Bid[]) private bountyBids;
    mapping(uint256 => mapping(address => bool)) public hasBidded;
    mapping(address => uint256) public withdrawableBalance;

    // Custom Errors

    error AlreadyRegistered();
    error UserNotRegistered();
    error InvalidRole();
    error OnlyClientAllowed();
    error OnlyFreelancerAllowed();
    error OnlyArbiterAllowed();
    error OnlyChosenFreelancerAllowed();
    error ReputationTooLow(uint256 currentReputation, uint256 requiredReputation);
    error ExceedsMaxBudget(uint256 askingPrice, uint256 maxBudget);
    error BountyNotOpen();
    error BountyNotLocked();
    error BountyNotDisputed();
    error BidNotFound();
    error AlreadyBidded();
    error InsufficientPayment(uint256 requiredAmount, uint256 providedAmount);
    error InvalidBudget();
    error WorkNotSubmitted();
    error NoBalanceToClaim();
    error TransferFailed();

    // Events

    event UserRegistered(
        address indexed userAddress, string name, Role role, string ipfsAvatarHash, uint256 reputationScore
    );

    event BountyPosted(
        uint256 indexed bountyId, address indexed client, uint256 maxBudget, string ipfsBountyDetailsHash
    );

    event BidSubmitted(uint256 indexed bountyId, address indexed freelancer, uint256 askingPrice);

    event EscrowFunded(
        uint256 indexed bountyId,
        address indexed client,
        address indexed freelancer,
        uint256 escrowAmount,
        uint256 refundedExcess
    );

    event WorkSubmitted(uint256 indexed bountyId, address indexed freelancer, string ipfsWorkFileHash);

    event WorkApproved(
        uint256 indexed bountyId,
        address indexed client,
        address indexed freelancer,
        uint256 freelancerPayout,
        uint256 arbiterFee
    );

    event FundsClaimed(address indexed user, uint256 amount);

    event DisputeRaised(uint256 indexed bountyId, address indexed raisedBy);

    event DisputeResolved(
        uint256 indexed bountyId,
        bool freelancerFault,
        uint256 refundedClientAmount,
        uint256 freelancerPayout,
        uint256 arbiterFee
    );

    // Modifiers

    modifier onlyArbiter() {
        if (msg.sender != arbiter) revert OnlyArbiterAllowed();
        _;
    }

    // Constructor

    constructor() {
        arbiter = msg.sender;
    }

    // Core Functions

    function registerUser(string calldata _name, Role _role, string calldata _ipfsAvatarHash) external {
        if (users[msg.sender].isRegistered) revert AlreadyRegistered();
        if (_role != Role.Client && _role != Role.Freelancer) revert InvalidRole();

        uint256 initialReputation = (_role == Role.Freelancer) ? 100 : 0;

        users[msg.sender] = User({
            name: _name,
            role: _role,
            ipfsAvatarHash: _ipfsAvatarHash,
            reputationScore: initialReputation,
            isRegistered: true
        });

        emit UserRegistered(msg.sender, _name, _role, _ipfsAvatarHash, initialReputation);
    }

    function postBounty(uint256 _maxBudget, string calldata _ipfsBountyDetailsHash) external returns (uint256) {
        if (users[msg.sender].role != Role.Client) revert OnlyClientAllowed();
        if (_maxBudget == 0) revert InvalidBudget();

        bountyCount++;
        uint256 newBountyId = bountyCount;

        bounties[newBountyId] = Bounty({
            id: newBountyId,
            client: msg.sender,
            maxBudget: _maxBudget,
            ipfsBountyDetailsHash: _ipfsBountyDetailsHash,
            status: BountyStatus.Open,
            chosenFreelancer: address(0),
            escrowAmount: 0,
            ipfsWorkFileHash: ""
        });

        emit BountyPosted(newBountyId, msg.sender, _maxBudget, _ipfsBountyDetailsHash);
        return newBountyId;
    }

    function submitBid(uint256 _bountyId, uint256 _askingPrice) external {
        if (users[msg.sender].role != Role.Freelancer) revert OnlyFreelancerAllowed();

        Bounty storage bounty = bounties[_bountyId];
        if (bounty.id == 0 || bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (users[msg.sender].reputationScore < 40) {
            revert ReputationTooLow(users[msg.sender].reputationScore, 40);
        }
        if (_askingPrice > bounty.maxBudget) {
            revert ExceedsMaxBudget(_askingPrice, bounty.maxBudget);
        }

        if (hasBidded[_bountyId][msg.sender]) revert AlreadyBidded();

        bountyBids[_bountyId].push(Bid({freelancer: msg.sender, askingPrice: _askingPrice}));
        hasBidded[_bountyId][msg.sender] = true;

        emit BidSubmitted(_bountyId, msg.sender, _askingPrice);
    }

    function fundEscrow(uint256 _bountyId, address _freelancer) external payable {
        Bounty storage bounty = bounties[_bountyId];
        if (bounty.id == 0 || bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (msg.sender != bounty.client) revert OnlyClientAllowed();

        uint256 askingPrice = 0;
        bool found = false;
        Bid[] storage bids = bountyBids[_bountyId];
        for (uint256 i = 0; i < bids.length; i++) {
            if (bids[i].freelancer == _freelancer) {
                askingPrice = bids[i].askingPrice;
                found = true;
                break;
            }
        }
        if (!found) revert BidNotFound();

        if (msg.value < askingPrice) {
            revert InsufficientPayment(askingPrice, msg.value);
        }

        uint256 excess = msg.value - askingPrice;

        bounty.escrowAmount = askingPrice;
        bounty.chosenFreelancer = _freelancer;
        bounty.status = BountyStatus.Locked;

        if (excess > 0) {
            (bool refundSuccess,) = payable(msg.sender).call{value: excess}("");
            if (!refundSuccess) revert TransferFailed();
        }

        emit EscrowFunded(_bountyId, msg.sender, _freelancer, askingPrice, excess);
    }

    function submitWork(uint256 _bountyId, string calldata _ipfsWorkFileHash) external {
        Bounty storage bounty = bounties[_bountyId];
        if (bounty.id == 0 || bounty.status != BountyStatus.Locked) revert BountyNotLocked();
        if (msg.sender != bounty.chosenFreelancer) revert OnlyChosenFreelancerAllowed();

        bounty.ipfsWorkFileHash = _ipfsWorkFileHash;

        emit WorkSubmitted(_bountyId, msg.sender, _ipfsWorkFileHash);
    }

    function approveWork(uint256 _bountyId) external {
        Bounty storage bounty = bounties[_bountyId];
        if (bounty.id == 0 || bounty.status != BountyStatus.Locked) revert BountyNotLocked();
        if (msg.sender != bounty.client) revert OnlyClientAllowed();
        if (bytes(bounty.ipfsWorkFileHash).length == 0) revert WorkNotSubmitted();

        uint256 fee = (bounty.escrowAmount * PLATFORM_FEE_PERCENT) / 100;
        uint256 freelancerShare = bounty.escrowAmount - fee;

        withdrawableBalance[arbiter] += fee;
        withdrawableBalance[bounty.chosenFreelancer] += freelancerShare;

        users[bounty.chosenFreelancer].reputationScore += 15;
        bounty.status = BountyStatus.Resolved;

        emit WorkApproved(_bountyId, msg.sender, bounty.chosenFreelancer, freelancerShare, fee);
    }

    function raiseDispute(uint256 _bountyId) external {
        Bounty storage bounty = bounties[_bountyId];
        if (bounty.id == 0 || bounty.status != BountyStatus.Locked) revert BountyNotLocked();
        if (msg.sender != bounty.client && msg.sender != bounty.chosenFreelancer) revert UserNotRegistered();

        bounty.status = BountyStatus.Disputed;

        emit DisputeRaised(_bountyId, msg.sender);
    }

    function resolveDispute(uint256 _bountyId, bool _freelancerFault) external onlyArbiter {
        Bounty storage bounty = bounties[_bountyId];
        if (bounty.id == 0 || bounty.status != BountyStatus.Disputed) revert BountyNotDisputed();

        uint256 refundedClientAmount = 0;
        uint256 freelancerPayout = 0;
        uint256 fee = 0;

        if (_freelancerFault) {
            refundedClientAmount = bounty.escrowAmount;
            withdrawableBalance[bounty.client] += refundedClientAmount;

            uint256 currentRep = users[bounty.chosenFreelancer].reputationScore;
            if (currentRep >= 30) {
                users[bounty.chosenFreelancer].reputationScore -= 30;
            } else {
                users[bounty.chosenFreelancer].reputationScore = 0;
            }
        } else {
            fee = (bounty.escrowAmount * PLATFORM_FEE_PERCENT) / 100;
            freelancerPayout = bounty.escrowAmount - fee;

            withdrawableBalance[arbiter] += fee;
            withdrawableBalance[bounty.chosenFreelancer] += freelancerPayout;
        }

        bounty.status = BountyStatus.Resolved;

        emit DisputeResolved(_bountyId, _freelancerFault, refundedClientAmount, freelancerPayout, fee);
    }

    function claimFunds() external {
        uint256 amount = withdrawableBalance[msg.sender];
        if (amount == 0) revert NoBalanceToClaim();

        withdrawableBalance[msg.sender] = 0;

        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FundsClaimed(msg.sender, amount);
    }

    // View and Getter Functions

    function getBountyBids(uint256 _bountyId) external view returns (Bid[] memory) {
        return bountyBids[_bountyId];
    }

    function getAllBounties() external view returns (Bounty[] memory) {
        Bounty[] memory allBounties = new Bounty[](bountyCount);
        for (uint256 i = 1; i <= bountyCount; i++) {
            allBounties[i - 1] = bounties[i];
        }
        return allBounties;
    }

    function getUser(address _userAddress) external view returns (User memory) {
        return users[_userAddress];
    }
}
