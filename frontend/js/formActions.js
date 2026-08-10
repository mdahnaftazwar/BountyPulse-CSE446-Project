// frontend/js/formActions.js
// Checkpoint 3 — the write actions NOT already covered in contractService.js
// (fundEscrow and claimFunds already exist there — don't duplicate them).
// Relies on the globals `contract`, `account` and the `decodeError()` helper
// that contractService.js already declares at page scope.

async function registerUser() {
    const name = document.getElementById("regName").value;
    const role = document.getElementById("regRole").value; // "1" or "2"
    const file = document.getElementById("regAvatar").files[0];

    if (!name || !file) return alert("Name and avatar image are required.");

    try {
        const cid = await uploadFileToIPFS(file);
        const tx = await contract.registerUser(name, role, cid);
        await tx.wait();
        alert("Registered successfully!");

        document.getElementById("regName").value = "";
        document.getElementById("regAvatar").value = "";
        const avatarPreview = document.getElementById("regAvatarPreview");
        if (avatarPreview) avatarPreview.innerHTML = "";

        await renderDashboard();
    } catch (err) {
        console.error("registerUser failed:", err);
        alert(decodeError(err));
    }
}

async function postBounty() {
    const budgetEth = document.getElementById("bountyBudget").value;
    const description = document.getElementById("bountyDesc").value;

    if (!budgetEth || !description) return alert("Budget and description are required.");

    try {
        // Description goes to IPFS as JSON, only the CID is stored on-chain.
        const cid = await uploadJSONToIPFS({ description });
        const budgetWei = ethers.parseEther(budgetEth);
        const tx = await contract.postBounty(budgetWei, cid);
        await tx.wait();
        alert("Bounty posted!");

        document.getElementById("bountyBudget").value = "";
        document.getElementById("bountyDesc").value = "";

        await loadFeed();
        await populateBountySelects();
    } catch (err) {
        console.error("postBounty failed:", err);
        alert(decodeError(err));
    }
}

async function submitBid() {
    const bountyId = document.getElementById("bidBountySelect").value;
    const askingPriceEth = document.getElementById("bidAmount").value;

    if (!bountyId || !askingPriceEth) return alert("Select a bounty and enter your asking price.");

    try {
        const priceWei = ethers.parseEther(askingPriceEth);
        const tx = await contract.submitBid(bountyId, priceWei);
        await tx.wait();
        alert("Bid submitted!");
        document.getElementById("bidAmount").value = "";
    } catch (err) {
        console.error("submitBid failed:", err);
        alert(decodeError(err));
    }
}

async function submitWork() {
    const bountyId = document.getElementById("workBountySelect").value;
    const file = document.getElementById("workFile").files[0];

    if (!bountyId || !file) return alert("Select a bounty and choose a work file.");

    try {
        const cid = await uploadFileToIPFS(file);
        const tx = await contract.submitWork(bountyId, cid);
        await tx.wait();
        alert("Work submitted!");

        // Clear the local pre-upload preview and reset the file input —
        // the selected file has now actually been submitted, so showing
        // it as "not yet uploaded" afterward would be misleading.
        const localPreview = document.getElementById("workFileLocalPreview");
        if (localPreview) localPreview.innerHTML = "";
        document.getElementById("workFile").value = "";

        await loadFeed();
    } catch (err) {
        console.error("submitWork failed:", err);
        alert(decodeError(err));
    }
}

async function approveWork() {
    const bountyId = document.getElementById("approveBountySelect").value;
    if (!bountyId) return alert("Select a bounty to approve.");

    try {
        const tx = await contract.approveWork(bountyId);
        await tx.wait();
        alert("Work approved! Freelancer payout added to their withdrawable balance.");

        // Clear the Checkpoint 3 work-file preview — once approved, the
        // bounty leaves "awaiting approval" state, so a stale preview of
        // a now-resolved bounty shouldn't linger on screen.
        const workPreview = document.getElementById("workPreview");
        if (workPreview) workPreview.innerHTML = "";

        await loadFeed();
    } catch (err) {
        console.error("approveWork failed:", err);
        alert(decodeError(err));
    }
}

async function raiseDispute() {
    const bountyId = document.getElementById("disputeBountySelect").value;
    if (!bountyId) return alert("Select a bounty to dispute.");

    try {
        const tx = await contract.raiseDispute(bountyId);
        await tx.wait();
        alert("Dispute raised.");
        await loadFeed();
    } catch (err) {
        console.error("raiseDispute failed:", err);
        alert(decodeError(err));
    }
}

async function resolveDispute() {
    const bountyId = document.getElementById("resolveBountySelect").value;
    const freelancerFault = document.getElementById("resolveFaultSelect").value === "true";
    if (!bountyId) return alert("Select a bounty to resolve.");

    try {
        const tx = await contract.resolveDispute(bountyId, freelancerFault);
        await tx.wait();
        alert("Dispute resolved.");
        await loadFeed();
    } catch (err) {
        console.error("resolveDispute failed:", err);
        alert(decodeError(err));
    }
}

// Helper used by the "Fund Escrow" form (fundEscrow() itself already lives
// in contractService.js) — populates the freelancer dropdown for a chosen
// bounty from the real bids on-chain, so the client can pick who to pay.
async function loadFreelancersForBounty(bountyId) {
    const select = document.getElementById("fundFreelancerSelect");
    select.innerHTML = "";
    if (!bountyId) return;

    const bids = await fetchBidsForBounty(bountyId);
    for (const bid of bids) {
        const opt = document.createElement("option");
        opt.value = bid.freelancer;
        opt.dataset.price = bid.askingPrice.toString(); // store wei as string

        // Show reputation alongside price so the Client can make an
        // informed choice between bidders, not just pick by lowest price.
        let repLabel = "";
        try {
            const bidder = await fetchUser(bid.freelancer);
            repLabel = ` — rep ${bidder.reputation}`;
        } catch (e) { /* fall back to no reputation shown */ }

        opt.textContent = `${bid.freelancer.slice(0, 6)}...${bid.freelancer.slice(-4)} — ${ethers.formatEther(bid.askingPrice)} ETH${repLabel}`;
        select.appendChild(opt);
    }

    // Setting innerHTML doesn't fire a "change" event (same issue we hit
    // with this exact dropdown before), so pre-fill the amount field
    // directly here rather than waiting for one that may never come.
    prefillFundAmount();
}

// Pre-fills #fundAmount to match the currently selected bid, as a sensible
// default — but the field stays fully editable, so the Client can send
// less (triggers InsufficientPayment revert) or more (triggers the
// excess-refund path) to genuinely exercise both contract behaviors.
function prefillFundAmount() {
    const freelancerSelect = document.getElementById("fundFreelancerSelect");
    const amountInput = document.getElementById("fundAmount");
    if (!freelancerSelect || !amountInput) return;

    const selectedOption = freelancerSelect.selectedOptions[0];
    amountInput.value = selectedOption && selectedOption.dataset.price
        ? ethers.formatEther(selectedOption.dataset.price)
        : "";
}

async function submitFundEscrow() {
    const bountyId = document.getElementById("fundBountySelect").value;
    const freelancerSelect = document.getElementById("fundFreelancerSelect");
    const freelancerAddress = freelancerSelect.value;
    const amountInput = document.getElementById("fundAmount");
    const amountEth = amountInput ? amountInput.value : "";

    if (!bountyId || !freelancerAddress) {
        return alert("Select a bounty and a freelancer bid to fund.");
    }
    if (!amountEth || Number(amountEth) <= 0) {
        return alert("Enter an amount to send.");
    }

    const amountWei = ethers.parseEther(amountEth);
    await fundEscrow(bountyId, freelancerAddress, amountWei); // defined in contractService.js

    if (amountInput) amountInput.value = "";
    await populateBountySelects();
}
