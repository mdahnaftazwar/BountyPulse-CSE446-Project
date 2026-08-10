// frontend/js/ui.js
// Role-based dashboard switching and dropdown population.
// Relies on globals from contractService.js (contract, account, fetchUser,
// fetchBounties, fetchBidsForBounty, getWithdrawableBalance) and config.js (ROLE).

let isArbiter = false;
let myRole = 0; // ROLE.None

async function renderDashboard() {
    try {
        const arbiterAddress = await contract.arbiter();
        isArbiter = account.toLowerCase() === arbiterAddress.toLowerCase();

        let user = { role: 0, isRegistered: false };
        if (!isArbiter) {
            user = await fetchUser(account);
        }
        myRole = isArbiter ? "arbiter" : user.role;

        show("registerArea", !isArbiter && !user.isRegistered);
        show("clientArea", myRole === 1);
        show("freelancerArea", myRole === 2);
        show("disputeArea", myRole === 1 || myRole === 2);
        show("arbiterArea", isArbiter);
        // Earnings panel is only for roles that actually claim through
        // withdrawableBalance: Freelancer and Arbiter. Clients no longer
        // show this at all — their dispute refund is intended to go
        // directly to their wallet (see contract-side change).
        show("earningsArea", myRole === 2 || isArbiter);

        const roleTag = document.getElementById("roleTag");
        if (roleTag) {
            roleTag.style.display = "block";
            roleTag.textContent = isArbiter
                ? "Role: Arbiter"
                : myRole === 1
                ? "Role: Client"
                : myRole === 2
                ? "Role: Freelancer"
                : "Not registered yet";
        }

        // Identity header: name, role label, and avatar (with an initials
        // placeholder when there's no avatar — most notably the Arbiter,
        // who never registers and so never uploads one).
        const displayName = isArbiter ? "Arbiter" : (user.isRegistered ? user.name : "Not registered");
        const nameEl = document.getElementById("myName");
        if (nameEl) nameEl.textContent = displayName;

        const roleLabelEl = document.getElementById("myRoleLabel");
        if (roleLabelEl) {
            roleLabelEl.textContent = isArbiter
                ? "Platform Arbiter"
                : myRole === 1
                ? "Client"
                : myRole === 2
                ? "Freelancer"
                : "Unregistered";
        }

        if (typeof renderMyAvatar === "function") {
            const avatarHash = !isArbiter && user.isRegistered ? user.avatarHash : null;
            await renderMyAvatar(avatarHash, displayName);
        }

        if (myRole === 2 || isArbiter) {
            const balance = await getWithdrawableBalance(account);
            const el = document.getElementById("unclaimedAmount");
            if (el) el.textContent = balance + " ETH";
        }

        // Reputation is only meaningful for Freelancers — Clients are
        // always initialized at 0 and it never changes for them, and
        // Arbiters aren't tracked in the registry at all.
        show("reputationBlock", myRole === 2);
        if (myRole === 2) {
            const el = document.getElementById("reputationFigure");
            if (el) el.textContent = user.reputation;
        }

        await populateBountySelects();
    } catch (err) {
        console.error("renderDashboard failed:", err);
    }
}

function show(elementId, visible) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = visible ? "block" : "none";
}

// Populates every <select> that needs a list of bounty IDs, filtered to the
// status that makes sense for that action (Open for bidding/funding,
// Locked for work submission/approval/dispute).
async function populateBountySelects() {
    const bounties = await fetchBounties();
    const open = bounties.filter((b) => b.status === 0);
    const locked = bounties.filter((b) => b.status === 1);

    // "Locked" alone isn't enough to know whether work is ready for
    // approval — split it by whether ipfsWorkFileHash has actually been
    // set yet, so each dropdown only shows bounties in the right state.
    const lockedAwaitingWork = locked.filter((b) => !b.workFileHash);
    const lockedAwaitingApproval = locked.filter((b) => b.workFileHash);
    const disputed = bounties.filter((b) => b.status === 3);

    fillSelect("bidBountySelect", open);
    fillSelect("fundBountySelect", open);
    fillSelect("workBountySelect", lockedAwaitingWork);
    fillSelect("approveBountySelect", lockedAwaitingApproval);
    fillSelect("disputeBountySelect", locked); // disputes are valid at any point while Locked
    fillSelect("resolveBountySelect", disputed); // can only resolve once actually Disputed

    // Setting innerHTML does NOT fire a "change" event, so if there's only
    // one bounty (or the selection didn't actually change), the freelancer
    // dropdown for "Fund Escrow" — and the work-file preview for
    // "Approve Submitted Work" — would otherwise never load automatically.
    // Trigger both directly here instead of relying on change listeners alone.
    const fundBountySelect = document.getElementById("fundBountySelect");
    if (fundBountySelect && fundBountySelect.value) {
        await loadFreelancersForBounty(fundBountySelect.value);
    }

    const approveBountySelect = document.getElementById("approveBountySelect");
    if (approveBountySelect && approveBountySelect.value && typeof loadWorkPreview === "function") {
        await loadWorkPreview(approveBountySelect.value);
    }
}

function fillSelect(elementId, bounties) {
    const select = document.getElementById(elementId);
    if (!select) return;
    select.innerHTML = bounties
        .map((b) => `<option value="${b.id}">#${b.id} — ${ethers.formatEther(b.maxBudget)} ETH</option>`)
        .join("");
}
