// frontend/js/ipfsHelper.js
// Checkpoint 3 — Pinata / IPFS upload pipeline.
// Nothing here touches the contract; it only produces CIDs for other files to use.

// TODO: paste your own Pinata JWT (pinata.cloud -> API Keys -> create key with pinning scopes)
const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJlYjYxMjllOC1jY2RlLTRjODUtOWI3Mi1mOTA1ZGM2NGI5MDYiLCJlbWFpbCI6Im1haGluLmtob25kb2tlckBnLmJyYWN1LmFjLmJkIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6Ijk1MDhkZTI1MmFhNmM1NDM5M2ZmIiwic2NvcGVkS2V5U2VjcmV0IjoiOGFhODIyNzY0ZDg5NDBlNTFiMTg0N2M3N2YzNDYwZTNjNWZkN2NjNTI5NTFmOTg3NjEyYWFmZDJiMDY0NDI0MCIsImV4cCI6MTgxNzcyMTE1MH0.EkAavn0VwLtA7cDD7bWHeF-cu3_cX9bcJES9g7r4JYk";

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
