// frontend/js/ipfsRender.js
// Checkpoint 3 requirement (spec 3.3): "Images and text must render
// dynamically in the UI using an IPFS Gateway."
//
// contractService.js's renderBounties() currently only shows ID/Budget/
// Status/Client — it never fetches or displays the bounty description
// (stored off-chain as a CID) or any avatar/work-file images. This file
// overrides that single function with a version that does, without
// editing contractService.js directly. Function declarations loaded in
// a later <script> tag replace earlier ones of the same name in the
// global scope, so this must be loaded AFTER contractService.js and
// AFTER ipfsHelper.js (needs cidToGatewayUrl / fetchJSONFromIPFS).

const STATUS_STAMP_CLASS = { 0: "stamp-open", 1: "stamp-locked", 2: "stamp-resolved", 3: "stamp-disputed" };

async function renderBounties(bounties) {
    const feedEl = document.getElementById("feed");

    if (!bounties.length) {
        feedEl.innerHTML =
            `<thead><tr><th>ID</th><th>Description</th><th>Max Budget</th><th>Status</th><th>Client</th></tr></thead>
             <tbody><tr class="empty-row"><td colspan="5">No bounties yet — post one to get started.</td></tr></tbody>`;
        return;
    }

    const rows = await Promise.all(bounties.map(async (b) => {
        // Fetch and render the bounty description text from IPFS (Checkpoint 3).
        let description = "—";
        if (b.detailsHash) {
            try {
                const meta = await fetchJSONFromIPFS(b.detailsHash);
                if (meta && meta.description) description = escapeHtml(meta.description);
            } catch (e) {
                description = "(could not load from IPFS)";
            }
        }

        // Fetch and render the client's avatar image from IPFS (Checkpoint 3).
        let avatarImg = "";
        try {
            const clientUser = await fetchUser(b.client);
            if (clientUser && clientUser.avatarHash) {
                avatarImg = `<img class="avatar-thumb" src="${cidToGatewayUrl(clientUser.avatarHash)}" alt="" onerror="this.style.display='none'">`;
            }
        } catch (e) { /* address may not be registered (e.g. arbiter) — skip avatar */ }

        return `
        <tr>
            <td class="col-id">#${b.id}</td>
            <td>${description}</td>
            <td class="col-amount">${ethers.formatEther(b.maxBudget)} ETH</td>
            <td><span class="stamp ${STATUS_STAMP_CLASS[b.status]}">${BOUNTY_STATUS[b.status]}</span></td>
            <td class="col-addr">${avatarImg}${b.client.slice(0, 6)}...${b.client.slice(-4)}</td>
        </tr>`;
    }));

    feedEl.innerHTML =
        "<thead><tr><th>ID</th><th>Description</th><th>Max Budget</th><th>Status</th><th>Client</th></tr></thead><tbody>" +
        rows.join("") + "</tbody>";
}

// Renders the currently connected user's own avatar in the identity sidebar.
// Falls back to an initials placeholder (rather than just hiding the image
// and leaving an empty gap) when no avatar hash exists yet — most notably
// for the Arbiter, who never registers or uploads one.
async function renderMyAvatar(avatarHash, displayName) {
    const img = document.getElementById("myAvatar");
    const placeholder = document.getElementById("myAvatarPlaceholder");
    if (!img || !placeholder) return;

    if (avatarHash) {
        img.src = cidToGatewayUrl(avatarHash);
        img.style.display = "block";
        placeholder.style.display = "none";
    } else {
        img.style.display = "none";
        placeholder.style.display = "flex";
        const initial = (displayName || "?").trim().charAt(0).toUpperCase() || "?";
        placeholder.textContent = initial;
    }
}

// Renders a preview of the submitted work file (image or link) for whichever
// bounty is selected in the "Approve Submitted Work" dropdown — this is the
// "final submitted work files" rendering requirement from the spec.
async function loadWorkPreview(bountyId) {
    const container = document.getElementById("workPreview");
    if (!container) return;
    container.innerHTML = "";
    if (!bountyId) return;

    const bounties = await fetchBounties();
    const bounty = bounties.find((b) => b.id === Number(bountyId));
    if (!bounty || !bounty.workFileHash) return;

    const url = cidToGatewayUrl(bounty.workFileHash);
    container.innerHTML = `
        <img src="${url}" alt="Submitted work" class="work-preview-img"
             onerror="this.style.display='none'; document.getElementById('workPreviewFallback').style.display='block';">
        <p id="workPreviewFallback" style="display:none;" class="field-label">
            File isn't an image — <a href="${url}" target="_blank" rel="noopener">open submitted file ↗</a>
        </p>
        <p class="field-label" style="margin-top:6px;">
            <a href="${url}" target="_blank" rel="noopener">View on IPFS gateway ↗</a>
        </p>`;
}

// Minimal HTML-escaping so a malicious/odd description can't break the table.
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// Local (pre-upload) file preview — lets the Freelancer/Client confirm
// they picked the right file BEFORE it gets pinned to IPFS and sent
// on-chain, since neither of those steps can be undone. Uses a local
// blob URL, so this is instant and needs no network call.
function wireLocalFilePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    let lastBlobUrl = null;

    input.addEventListener("change", () => {
        if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl); // avoid leaking memory across repeated selections
        preview.innerHTML = "";

        const file = input.files[0];
        if (!file) return;

        lastBlobUrl = URL.createObjectURL(file);

        if (file.type.startsWith("image/")) {
            preview.innerHTML = `
                <img src="${lastBlobUrl}" alt="Preview of ${escapeHtml(file.name)}" class="work-preview-img">
                <p class="field-label" style="margin-top:4px;">${escapeHtml(file.name)} — not yet uploaded</p>`;
        } else {
            preview.innerHTML = `
                <p class="field-label">Selected: ${escapeHtml(file.name)} — not yet uploaded</p>`;
        }
    });
}
