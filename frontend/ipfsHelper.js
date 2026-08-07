// ipfsHelper.js
// Handles all Pinata / IPFS uploads. Nothing here should talk to the smart contract.

window.uploadToIPFS = async (file) => {
    // TODO: replace with your own Pinata JWT (get one at pinata.cloud -> API Keys)
    const PINATA_JWT = "YOUR_JWT_TOKEN_HERE";

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: "POST",
            headers: { Authorization: `Bearer ${PINATA_JWT}` },
            body: formData,
        });
        const data = await response.json();
        return data.IpfsHash; // the CID
    } catch (error) {
        console.error("IPFS upload error:", error);
    }
};

window.cidToGatewayUrl = (cid) => `https://gateway.pinata.cloud/ipfs/${cid}`;
