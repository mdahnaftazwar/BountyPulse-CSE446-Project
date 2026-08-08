// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BountyPulse.sol";

contract BountyPulseTest is Test {
    BountyPulse public contractInstance;

    address public arbiter = address(this);
    address public client1 = address(0x101);
    address public client2 = address(0x102);
    address public freelancer1 = address(0x201);
    address public freelancer2 = address(0x202);
    address public lowRepFreelancer = address(0x203);

    receive() external payable {}

    function setUp() public {
        contractInstance = new BountyPulse();

        // Fund test accounts
        vm.deal(client1, 100 ether);
        vm.deal(client2, 100 ether);
        vm.deal(freelancer1, 10 ether);
        vm.deal(freelancer2, 10 ether);

        // Register Users
        vm.prank(client1);
        contractInstance.registerUser("Alice Client", BountyPulse.Role.Client, "QmClient1AvatarCID");

        vm.prank(freelancer1);
        contractInstance.registerUser("Bob Freelancer", BountyPulse.Role.Freelancer, "QmFreelancer1AvatarCID");

        vm.prank(freelancer2);
        contractInstance.registerUser("Charlie Freelancer", BountyPulse.Role.Freelancer, "QmFreelancer2AvatarCID");

        // Register low rep freelancer and manually lower rep
        vm.prank(lowRepFreelancer);
        contractInstance.registerUser("LowRep Dave", BountyPulse.Role.Freelancer, "QmLowRepCID");
    }

    function testUserRegistration() public view {
        BountyPulse.User memory u = contractInstance.getUser(client1);
        assertEq(u.name, "Alice Client");
        assertTrue(u.role == BountyPulse.Role.Client);
        assertEq(u.ipfsAvatarHash, "QmClient1AvatarCID");
        assertEq(u.reputationScore, 0);
        assertTrue(u.isRegistered);

        BountyPulse.User memory freeUser = contractInstance.getUser(freelancer1);
        assertTrue(freeUser.role == BountyPulse.Role.Freelancer);
        assertEq(freeUser.reputationScore, 100);
    }

    function testCannotRegisterTwice() public {
        vm.prank(client1);
        vm.expectRevert(BountyPulse.AlreadyRegistered.selector);
        contractInstance.registerUser("Alice Again", BountyPulse.Role.Client, "QmAvatar");
    }

    function testPostBounty() public {
        vm.prank(client1);
        uint256 bountyId = contractInstance.postBounty(1 ether, "QmBountyDetailsCID");
        assertEq(bountyId, 1);

        (
            uint256 id,
            address client,
            uint256 maxBudget,
            string memory detailsHash,
            BountyPulse.BountyStatus status,
            address chosenFreelancer,
            uint256 escrowAmount,
            string memory workHash
        ) = contractInstance.bounties(1);

        assertEq(id, 1);
        assertEq(client, client1);
        assertEq(maxBudget, 1 ether);
        assertEq(detailsHash, "QmBountyDetailsCID");
        assertTrue(status == BountyPulse.BountyStatus.Open);
        assertEq(chosenFreelancer, address(0));
        assertEq(escrowAmount, 0);
        assertEq(bytes(workHash).length, 0);
    }

    function testSubmitBidSuccess() public {
        vm.prank(client1);
        contractInstance.postBounty(1 ether, "QmBountyDetailsCID");

        vm.prank(freelancer1);
        contractInstance.submitBid(1, 0.8 ether);

        BountyPulse.Bid[] memory bids = contractInstance.getBountyBids(1);
        assertEq(bids.length, 1);
        assertEq(bids[0].freelancer, freelancer1);
        assertEq(bids[0].askingPrice, 0.8 ether);
    }

    function testSubmitBidExceedsMaxBudgetReverts() public {
        vm.prank(client1);
        contractInstance.postBounty(1 ether, "QmBountyDetailsCID");

        vm.prank(freelancer1);
        vm.expectRevert(abi.encodeWithSelector(BountyPulse.ExceedsMaxBudget.selector, 1.2 ether, 1 ether));
        contractInstance.submitBid(1, 1.2 ether);
    }

    function testSubmitBidReputationGateReverts() public {
        vm.prank(client1);
        contractInstance.postBounty(1 ether, "QmBountyDetailsCID");

        // Simulate lowering Dave's reputation score to 10 (100 - 30*3 = 10)
        _penalizeFreelancer(lowRepFreelancer);
        _penalizeFreelancer(lowRepFreelancer);
        _penalizeFreelancer(lowRepFreelancer);

        BountyPulse.User memory dave = contractInstance.getUser(lowRepFreelancer);
        assertTrue(dave.reputationScore < 40);

        vm.prank(lowRepFreelancer);
        vm.expectRevert(abi.encodeWithSelector(BountyPulse.ReputationTooLow.selector, dave.reputationScore, 40));
        contractInstance.submitBid(1, 0.5 ether);
    }

    function testEscrowFundingUnderpaymentReverts() public {
        vm.prank(client1);
        contractInstance.postBounty(1 ether, "QmBountyDetailsCID");

        vm.prank(freelancer1);
        contractInstance.submitBid(1, 0.8 ether);

        // Client attempts to send 0.5 ether (less than 0.8 ether)
        vm.prank(client1);
        vm.expectRevert(abi.encodeWithSelector(BountyPulse.InsufficientPayment.selector, 0.8 ether, 0.5 ether));
        contractInstance.fundEscrow{value: 0.5 ether}(1, freelancer1);
    }

    function testEscrowFundingExactAndExcessRefund() public {
        vm.prank(client1);
        contractInstance.postBounty(1 ether, "QmBountyDetailsCID");

        vm.prank(freelancer1);
        contractInstance.submitBid(1, 0.8 ether);

        uint256 initialClientBalance = client1.balance;

        // Client sends 1 ether for a 0.8 ether bid (0.2 ether excess)
        vm.prank(client1);
        contractInstance.fundEscrow{value: 1.0 ether}(1, freelancer1);

        // Balance check: client spent exactly 0.8 ether (1.0 sent - 0.2 refunded)
        assertEq(client1.balance, initialClientBalance - 0.8 ether);

        (,,,, BountyPulse.BountyStatus status, address chosen, uint256 escrow,) = contractInstance.bounties(1);
        assertTrue(status == BountyPulse.BountyStatus.Locked);
        assertEq(chosen, freelancer1);
        assertEq(escrow, 0.8 ether);
    }

    function testWorkSubmissionAndApprovalMath() public {
        // Setup bounty & funding
        vm.prank(client1);
        contractInstance.postBounty(2 ether, "QmDetails");

        vm.prank(freelancer1);
        contractInstance.submitBid(1, 2 ether);

        vm.prank(client1);
        contractInstance.fundEscrow{value: 2 ether}(1, freelancer1);

        // Freelancer submits work
        vm.prank(freelancer1);
        contractInstance.submitWork(1, "QmWorkResultCID");

        // Client approves work
        vm.prank(client1);
        contractInstance.approveWork(1);

        // Percentage Math Verification:
        // Escrow = 2 ether (2,000,000,000,000,000,000 wei)
        // 2% Arbiter Fee = 0.04 ether
        // 98% Freelancer Share = 1.96 ether
        uint256 expectedFee = (2 ether * 2) / 100; // 0.04 ether
        uint256 expectedFreelancerShare = 2 ether - expectedFee; // 1.96 ether

        assertEq(contractInstance.withdrawableBalance(arbiter), expectedFee);
        assertEq(contractInstance.withdrawableBalance(freelancer1), expectedFreelancerShare);

        // Reputation score should increase from 100 to 115
        BountyPulse.User memory f1 = contractInstance.getUser(freelancer1);
        assertEq(f1.reputationScore, 115);
    }

    function testDisputeResolutionFreelancerFault() public {
        vm.prank(client1);
        contractInstance.postBounty(1 ether, "QmDetails");

        vm.prank(freelancer1);
        contractInstance.submitBid(1, 1 ether);

        vm.prank(client1);
        contractInstance.fundEscrow{value: 1 ether}(1, freelancer1);

        vm.prank(freelancer1);
        contractInstance.submitWork(1, "QmBadWork");

        vm.prank(client1);
        contractInstance.raiseDispute(1);

        // Arbiter resolves dispute with Freelancer Fault = true
        contractInstance.resolveDispute(1, true);

        // 100% refunded to Client withdrawable balance
        assertEq(contractInstance.withdrawableBalance(client1), 1 ether);

        // Reputation penalty: 100 - 30 = 70
        BountyPulse.User memory f1 = contractInstance.getUser(freelancer1);
        assertEq(f1.reputationScore, 70);
    }

    function testDisputeResolutionClientFault() public {
        vm.prank(client1);
        contractInstance.postBounty(1 ether, "QmDetails");

        vm.prank(freelancer1);
        contractInstance.submitBid(1, 1 ether);

        vm.prank(client1);
        contractInstance.fundEscrow{value: 1 ether}(1, freelancer1);

        vm.prank(client1);
        contractInstance.raiseDispute(1);

        // Arbiter resolves dispute with Freelancer Fault = false
        contractInstance.resolveDispute(1, false);

        uint256 expectedFee = 0.02 ether;
        uint256 expectedFreelancerShare = 0.98 ether;

        assertEq(contractInstance.withdrawableBalance(arbiter), expectedFee);
        assertEq(contractInstance.withdrawableBalance(freelancer1), expectedFreelancerShare);
    }

    function testClaimFundsPullPayment() public {
        vm.prank(client1);
        contractInstance.postBounty(1 ether, "QmDetails");

        vm.prank(freelancer1);
        contractInstance.submitBid(1, 1 ether);

        vm.prank(client1);
        contractInstance.fundEscrow{value: 1 ether}(1, freelancer1);

        vm.prank(freelancer1);
        contractInstance.submitWork(1, "QmWork");

        vm.prank(client1);
        contractInstance.approveWork(1);

        uint256 initialFreelancerBalance = freelancer1.balance;
        uint256 withdrawable = contractInstance.withdrawableBalance(freelancer1);

        // Freelancer claims funds
        vm.prank(freelancer1);
        contractInstance.claimFunds();

        assertEq(freelancer1.balance, initialFreelancerBalance + withdrawable);
        assertEq(contractInstance.withdrawableBalance(freelancer1), 0);
    }

    // Helper to penalize freelancer rep for testing
    function _penalizeFreelancer(address target) internal {
        vm.prank(client1);
        uint256 bId = contractInstance.postBounty(1 ether, "QmPenalize");

        vm.prank(target);
        contractInstance.submitBid(bId, 1 ether);

        vm.prank(client1);
        contractInstance.fundEscrow{value: 1 ether}(bId, target);

        vm.prank(client1);
        contractInstance.raiseDispute(bId);

        contractInstance.resolveDispute(bId, true);
    }
}
