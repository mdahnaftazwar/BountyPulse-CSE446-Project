// frontend/js/eventListeners.js
// Checkpoint 5 — real-time updates via contract.on(...).
// No window.location.reload() anywhere. Every handler re-fetches only what
// changed and re-renders, so a second open browser window updates live.

function subscribeToEvents() {
    contract.on("BountyPosted", async () => {
        await loadFeed();
        await populateBountySelects();
    });

    contract.on("BidSubmitted", async () => {
        // Refresh the freelancer dropdown if the client currently has a
        // bounty selected in the "Fund Escrow" form.
        const fundSelect = document.getElementById("fundBountySelect");
        if (fundSelect && fundSelect.value) {
            await loadFreelancersForBounty(fundSelect.value);
        }
    });

    contract.on("EscrowFunded", async () => {
        await loadFeed();
        await populateBountySelects();
    });

    contract.on("WorkSubmitted", async () => {
        await loadFeed();
        await populateBountySelects();
    });

    contract.on("WorkApproved", async (bountyId, client, freelancer) => {
        await loadFeed();
        await populateBountySelects();
        // If this browser tab belongs to the freelancer who just got paid,
        // refresh their unclaimed earnings live — this is the exact
        // Checkpoint 5 demo scenario (two windows, one Client one Freelancer).
        if (account && freelancer && account.toLowerCase() === freelancer.toLowerCase()) {
            const balance = await getWithdrawableBalance(account);
            const el = document.getElementById("unclaimedAmount");
            if (el) el.textContent = balance + " ETH";
        }
    });

    contract.on("DisputeRaised", async () => {
        await loadFeed();
        await populateBountySelects();
    });

    contract.on("DisputeResolved", async () => {
        await loadFeed();
        await populateBountySelects();
        if (myRole === 1 || myRole === 2 || isArbiter) {
            const balance = await getWithdrawableBalance(account);
            const el = document.getElementById("unclaimedAmount");
            if (el) el.textContent = balance + " ETH";
        }
    });

    contract.on("FundsClaimed", async (user, amount) => {
        if (account && user.toLowerCase() === account.toLowerCase()) {
            const el = document.getElementById("unclaimedAmount");
            if (el) el.textContent = "0 ETH";
        }
    });

    contract.on("UserRegistered", async (userAddress) => {
        if (account && userAddress.toLowerCase() === account.toLowerCase()) {
            await renderDashboard();
        }
    });
}
