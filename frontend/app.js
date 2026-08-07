// app.js
// Ethers.js bridge between the frontend and the deployed BountyPulse contract.

// TODO: update once the contract is deployed (Member 1 will give you this)
const CONTRACT_ADDRESS = "0xYOUR_DEPLOYED_ADDRESS_HERE";

// TODO: replace with the real ABI once BountyPulse.sol is finalized and compiled.
// Get this from contracts/out/BountyPulse.sol/BountyPulse.json -> "abi" field,
// or ask Member 1 for the human-readable function signatures like below.
const CONTRACT_ABI = [
    // "function register(string name, uint8 role, string ipfsAvatarHash)",
    // "function postBounty(uint256 maxBudget, string ipfsBountyDetailsHash)",
    // "function submitBid(uint256 bountyId, uint256 askingPrice)",
    // "function fundEscrow(uint256 bountyId, uint256 bidId) payable",
    // "function submitWork(uint256 bountyId, string ipfsWorkFileHash)",
    // "function approveWork(uint256 bountyId)",
    // "function claimFunds()",
    // "function disputeWork(uint256 bountyId)",
    // "function resolveDispute(uint256 bountyId, bool freelancerAtFault)",
    // "function users(address) view returns (string name, uint8 role, string ipfsAvatarHash, uint256 reputation)",
    // "event BountyPosted(uint256 indexed bountyId, address indexed client)",
    // "event BidSubmitted(uint256 indexed bountyId, address indexed freelancer, uint256 amount)",
    // "event WorkApproved(uint256 indexed bountyId)",
    // "event FundsClaimed(address indexed user, uint256 amount)"
];

const App = {
    provider: null, signer: null, contract: null, account: null, isRendering: false,
    bounties: [], // cached locally for client-side sorting

    // ---------------------------------------------------------------
    // SECTION: Connection
    // ---------------------------------------------------------------
    init: async function () {
        if (typeof window.ethereum === 'undefined') await new Promise(r => setTimeout(r, 1000));
        if (!window.ethereum) return alert("MetaMask not installed!");

        try {
            this.provider = new ethers.BrowserProvider(window.ethereum);
            await this.provider.send("eth_requestAccounts", []);
            this.signer = await this.provider.getSigner();
            this.account = await this.signer.getAddress();
            this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.signer);

            $("#accountAddress").text("Connected: " + this.account);

            window.ethereum.on('accountsChanged', async (accounts) => {
                this.account = accounts[0];
                this.signer = await this.provider.getSigner();
                this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.signer);
                await this.render();
            });

            this.listenForEvents();
            await this.render();
        } catch (err) {
            alert("Failed to connect: " + err.message);
        }
    },

    // ---------------------------------------------------------------
    // SECTION: Rendering
    // ---------------------------------------------------------------
    render: async function () {
        if (this.isRendering) return;
        this.isRendering = true;
        try {
            // TODO: once contract is ready —
            // 1. look up this.account in the registry to determine role
            // 2. show/hide #registerArea, #clientArea, #freelancerArea, #earningsArea accordingly
            // 3. call this.loadBounties() to populate the feed
        } catch (err) {
            console.error(err);
        }
        this.isRendering = false;
    },

    loadBounties: async function () {
        // TODO: fetch all bounties from the contract into this.bounties
        // then call this.renderBountyFeed()
    },

    renderBountyFeed: function () {
        const sortBy = $("#sortSelect").val();
        let sorted = [...this.bounties];

        // Client-side sorting — gas-optimization point: sorting happens off-chain in JS,
        // not by looping/sorting in Solidity, which would cost gas.
        if (sortBy === "budget-desc") sorted.sort((a, b) => b.maxBudget - a.maxBudget);
        if (sortBy === "budget-asc") sorted.sort((a, b) => a.maxBudget - b.maxBudget);

        let rows = "";
        for (const b of sorted) {
            rows += `<tr><td>${b.description}</td><td>${b.maxBudget} ETH</td><td>${b.status}</td></tr>`;
        }
        $("#bountyTableBody").html(rows);
    },

    // ---------------------------------------------------------------
    // SECTION: Write actions (registration, posting, bidding, escrow)
    // ---------------------------------------------------------------
    register: async function () {
        const name = $("#regName").val();
        const role = $("#regRole").val();
        const file = document.getElementById("regAvatar").files[0];
        if (!file) return alert("Please select an avatar image");

        try {
            const cid = await window.uploadToIPFS(file);
            const tx = await this.contract.register(name, role, cid);
            await tx.wait();
        } catch (e) {
            console.error(e);
            alert("Registration failed. Check console.");
        }
    },

    postBounty: async function () {
        const budget = $("#bountyBudget").val();
        const desc = $("#bountyDesc").val();

        try {
            // TODO: upload description as JSON to IPFS if it needs to be off-chain,
            // or pass plain text if the contract expects a hash for a text blob.
            const budgetWei = ethers.parseEther(budget);
            const tx = await this.contract.postBounty(budgetWei, desc);
            await tx.wait();
        } catch (e) {
            console.error(e);
            alert("Posting bounty failed. Check console.");
        }
    },

    submitBid: async function () {
        const bountyId = $("#bidBountySelect").val();
        const amount = $("#bidAmount").val();

        try {
            const amountWei = ethers.parseEther(amount);
            const tx = await this.contract.submitBid(bountyId, amountWei);
            await tx.wait();
        } catch (e) {
            console.error(e);
            alert("Bid submission failed. Check console.");
        }
    },

    claimFunds: async function () {
        try {
            const tx = await this.contract.claimFunds();
            await tx.wait();
        } catch (e) {
            console.error(e);
            alert("Claim failed. Check console.");
        }
    },

    // ---------------------------------------------------------------
    // SECTION: Live event syncing (Checkpoint 5)
    // ---------------------------------------------------------------
    listenForEvents: function () {
        this.contract.on("BountyPosted", () => this.render());
        this.contract.on("BidSubmitted", () => this.render());
        this.contract.on("WorkApproved", () => this.render());
        this.contract.on("FundsClaimed", () => this.render());
    },
};

// ---------------------------------------------------------------
// SECTION: DOM bindings
// ---------------------------------------------------------------
$(function () {
    App.init();
    $("#registerBtn").on("click", () => App.register());
    $("#postBountyBtn").on("click", () => App.postBounty());
    $("#submitBidBtn").on("click", () => App.submitBid());
    $("#claimFundsBtn").on("click", () => App.claimFunds());
    $("#sortSelect").on("change", () => App.renderBountyFeed());
});
