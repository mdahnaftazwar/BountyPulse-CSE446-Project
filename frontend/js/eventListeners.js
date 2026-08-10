// frontend/js/eventListeners.js
// Checkpoint 5 — real-time updates via contract.on(...).
// No window.location.reload() anywhere. Every handler re-fetches only what
// changed and re-renders, so a second open browser window updates live.

function subscribeToEvents() {
    contract.on("BountyPosted", async () => {
        await loadFeed();
        await renderDashboard();
    });

    contract.on("BidSubmitted", async () => {
        await loadFeed();
        const fundSelect = document.getElementById("fundBountySelect");
        if (fundSelect && fundSelect.value) {
            await loadFreelancersForBounty(fundSelect.value);
        }
    });

    contract.on("EscrowFunded", async () => {
        await loadFeed();
        await renderDashboard();
    });

    contract.on("WorkSubmitted", async () => {
        await loadFeed();
        await renderDashboard();
    });

    contract.on("WorkApproved", async () => {
        await loadFeed();
        await renderDashboard();
    });

    contract.on("DisputeRaised", async () => {
        await loadFeed();
        await renderDashboard();
    });

    contract.on("DisputeResolved", async () => {
        await loadFeed();
        await renderDashboard();
    });

    contract.on("FundsClaimed", async () => {
        await loadFeed();
        await renderDashboard();
    });

    contract.on("UserRegistered", async (userAddress) => {
        if (account && userAddress.toLowerCase() === account.toLowerCase()) {
            await renderDashboard();
        }
    });
}