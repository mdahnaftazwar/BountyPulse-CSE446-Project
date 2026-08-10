// frontend/js/ipfsHelper.js
// Checkpoint 3 — Pinata / IPFS upload pipeline.
// Nothing here touches the contract; it only produces CIDs for other files to use.

// TODO: paste your own Pinata JWT (pinata.cloud -> API Keys -> create key with pinning scopes)
const PINATA_JWT = "PASTE_JWT_HERE";

async function uploadFileToIPFS(file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: "POST",
            headers: { Authorization: `Bearer ${PINATA_JWT}` },
            body: formData,
        });
        if (!response.ok) throw new Error(`Pinata upload failed: ${response.status}`);
        const data = await response.json();
        return data.IpfsHash; // the CID
    } catch (err) {
        console.error("IPFS file upload error:", err);
        alert("IPFS upload failed. Check console.");
        throw err;
    }
}

async function uploadJSONToIPFS(jsonObject) {
    try {
        const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${PINATA_JWT}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ pinataContent: jsonObject }),
        });
        if (!response.ok) throw new Error(`Pinata JSON upload failed: ${response.status}`);
        const data = await response.json();
        return data.IpfsHash;
    } catch (err) {
        console.error("IPFS JSON upload error:", err);
        alert("IPFS upload failed. Check console.");
        throw err;
    }
}

function cidToGatewayUrl(cid) {
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

async function fetchJSONFromIPFS(cid) {
    try {
        const res = await fetch(cidToGatewayUrl(cid));
        return await res.json();
    } catch (err) {
        console.error("IPFS fetch error:", err);
        return null;
    }
}
