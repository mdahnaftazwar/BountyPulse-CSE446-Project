// frontend/js/contractService.js

let provider, signer, contract, account;

async function initConnection() {
    if (typeof window.ethereum === "undefined") {
        alert("MetaMask not installed!");
        return;
    }
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = await signer.getAddress();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    document.getElementById("status").textContent = "Connected: " + account;

    window.ethereum.on("accountsChanged", async (accounts) => {
        account = accounts[0];
        signer = await provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        await loadFeed();
    });
}

// --- Read layer ---

async function fetchBounties() {
    // Single call returns the whole array — no manual loop needed
    const raw = await contract.getAllBounties();
    return raw.map((b) => ({
        id: Number(b.id),
        client: b.client,
        maxBudget: b.maxBudget,               // BigInt, wei
        detailsHash: b.ipfsBountyDetailsHash,
        status: Number(b.status),              // 0-3, decode via BOUNTY_STATUS
        chosenFreelancer: b.chosenFreelancer,
        escrowAmount: b.escrowAmount,
        workFileHash: b.ipfsWorkFileHash
    }));
}

async function fetchBidsForBounty(bountyId) {
    const raw = await contract.getBountyBids(bountyId);
    return raw.map((bid) => ({
        freelancer: bid.freelancer,
        askingPrice: bid.askingPrice           // BigInt, wei
    }));
}

async function fetchUser(address) {
    const u = await contract.getUser(address);
    return {
        name: u.name,
        role: Number(u.role),                  // 0-2, decode via ROLE
        avatarHash: u.ipfsAvatarHash,
        reputation: Number(u.reputationScore),
        isRegistered: u.isRegistered
    };
}

async function getWithdrawableBalance(address) {
    const bal = await contract.withdrawableBalance(address);
    return ethers.formatEther(bal);
}

// --- Sort (client-side — see gas-optimization note from earlier) ---

function sortBounties(bounties, criteria) {
    const sorted = [...bounties];
    if (criteria === "highest") sorted.sort((a, b) => (b.maxBudget > a.maxBudget ? 1 : -1));
    if (criteria === "lowest") sorted.sort((a, b) => (a.maxBudget > b.maxBudget ? 1 : -1));
    return sorted;
}

// --- Render ---

function renderBounties(bounties) {
    const rows = bounties.map((b) => `
        <tr>
            <td>${b.id}</td>
            <td>${ethers.formatEther(b.maxBudget)} ETH</td>
            <td>${BOUNTY_STATUS[b.status]}</td>
            <td>${b.client.slice(0, 6)}...${b.client.slice(-4)}</td>
        </tr>`).join("");
    document.getElementById("feed").innerHTML =
        "<tr><th>ID</th><th>Max Budget</th><th>Status</th><th>Client</th></tr>" + rows;
}

async function loadFeed(sortCriteria = null) {
    let bounties = await fetchBounties();
    if (sortCriteria) bounties = sortBounties(bounties, sortCriteria);
    renderBounties(bounties);
}

// --- Write layer: escrow funding ---

async function fundEscrow(bountyId, freelancerAddress, bidAmountWei) {
    try {
        const tx = await contract.fundEscrow(bountyId, freelancerAddress, { value: bidAmountWei });
        await tx.wait();
        alert("Escrow funded successfully");
        await loadFeed();
    } catch (err) {
        console.error("fundEscrow failed:", err);
        alert(decodeError(err));
    }
}

// --- Write layer: pull-payment claim ---

async function claimFunds() {
    try {
        const tx = await contract.claimFunds();
        await tx.wait();
        alert("Funds claimed");
    } catch (err) {
        console.error("claimFunds failed:", err);
        alert(decodeError(err));
    }
}

// --- Error decoding helper ---
// Ethers v6 surfaces custom Solidity errors in err.reason / err.shortMessage
function decodeError(err) {
    if (err.reason) return "Reverted: " + err.reason;
    if (err.shortMessage) return err.shortMessage;
    return "Transaction failed — check console";
}

// --- Bootstrap ---
initConnection().then(() => loadFeed());