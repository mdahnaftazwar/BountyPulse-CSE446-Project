// frontend/js/app.js
// Bootstraps the extra UI on top of contractService.js's existing
// initConnection()/loadFeed() flow, without modifying that file.

document.addEventListener("DOMContentLoaded", async () => {
    // Reliability fix: if the user switches networks in MetaMask mid-session,
    // ethers' cached provider connection can go stale and every call starts
    // failing with "could not decode result data" even though the contract
    // is fine. Reloading on chainChanged is the standard fix (recommended
    // directly in MetaMask's own docs) and avoids that entire class of bug
    // during testing/demos.
    if (window.ethereum) {
        window.ethereum.on("chainChanged", () => window.location.reload());

        // contractService.js already listens for accountsChanged and
        // refreshes the ledger table, but it doesn't re-run role detection
        // (renderDashboard) — so switching from a Client to a Freelancer
        // account, for example, would still show the old role's panel
        // until a manual reload. Adding a second listener on the same
        // event (MetaMask supports multiple) fixes that without touching
        // contractService.js. We poll for the global `account` to actually
        // match the newly selected address first, since both listeners
        // fire independently and contractService.js's handler needs to
        // finish reassigning `account`/`contract` before we re-render
        // against them.
        window.ethereum.on("accountsChanged", async (accounts) => {
            const target = accounts[0];
            if (!target) return; // wallet fully disconnected
            const start = Date.now();
            while (
                (typeof account === "undefined" || !account || account.toLowerCase() !== target.toLowerCase())
                && Date.now() - start < 5000
            ) {
                await new Promise((r) => setTimeout(r, 100));
            }
            await renderDashboard();
        });
    }

    // contractService.js calls initConnection() itself at the bottom of the
    // file and assigns the global `contract`/`account` inside that async
    // function. We just wait for it to finish before wiring up anything
    // that depends on `contract` existing.
    await waitForContract();

    await renderDashboard();
    subscribeToEvents();

    // Sort dropdown (uses sortBounties + fetchBounties + renderBounties,
    // all already defined in contractService.js)
    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
        sortSelect.addEventListener("change", async () => {
            await loadFeed(sortSelect.value);
        });
    }

    // Fund-escrow bounty select -> populate freelancer bid dropdown
    const fundBountySelect = document.getElementById("fundBountySelect");
    if (fundBountySelect) {
        fundBountySelect.addEventListener("change", (e) => {
            loadFreelancersForBounty(e.target.value);
        });
    }

    // Re-prefill the amount field whenever the Client picks a different
    // freelancer's bid in the "Fund Escrow" dropdown.
    const fundFreelancerSelect = document.getElementById("fundFreelancerSelect");
    if (fundFreelancerSelect) {
        fundFreelancerSelect.addEventListener("change", () => {
            prefillFundAmount();
        });
    }

    // Approve-work bounty select -> preview the submitted work file from
    // IPFS (Checkpoint 3 rendering requirement — see ipfsRender.js).
    const approveBountySelect = document.getElementById("approveBountySelect");
    if (approveBountySelect) {
        approveBountySelect.addEventListener("change", (e) => {
            loadWorkPreview(e.target.value);
        });
    }

    bindClick("registerBtn", registerUser);
    bindClick("postBountyBtn", postBounty);
    bindClick("submitBidBtn", submitBid);
    bindClick("fundEscrowBtn", submitFundEscrow);
    bindClick("submitWorkBtn", submitWork);
    bindClick("approveWorkBtn", approveWork);
    bindClick("raiseDisputeBtn", raiseDispute);
    bindClick("resolveDisputeBtn", resolveDispute);
    bindClick("claimFundsBtn", claimFunds); // already defined in contractService.js

    // Local (pre-upload) previews so a wrong file selection is caught
    // before it's pinned to IPFS — see ipfsRender.js.
    wireLocalFilePreview("regAvatar", "regAvatarPreview");
    wireLocalFilePreview("workFile", "workFileLocalPreview");
});

function bindClick(elementId, handler) {
    const el = document.getElementById(elementId);
    if (el) el.addEventListener("click", handler);
}

function waitForContract() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (typeof contract !== "undefined" && contract) {
                clearInterval(check);
                resolve();
            }
        }, 100);
    });
}
