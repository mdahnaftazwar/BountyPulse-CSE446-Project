# Ledger Design System — what changed and how to get the full effect

## Files changed
- `frontend/css/style.css` — new file, the whole design system
- `frontend/index.html` — restructured markup, but **every element ID your
  JS depends on is identical** (`status`, `feed`, `roleTag`, `registerArea`,
  `clientArea`, `freelancerArea`, `disputeArea`, `arbiterArea`,
  `earningsArea`, `unclaimedAmount`, every form input/select/button ID).
  None of your JS files need to change for the new look to work.
- Bootstrap CDN link removed — no longer needed, everything is custom CSS now.

## It'll work as-is, but the ledger table will look plainer than intended

Your teammate's `renderBounties()` in `contractService.js` builds the table
rows with no CSS classes on the `<td>` elements:

```js
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
```

This still renders fine with the new CSS (borders, spacing, hover — all
apply automatically), but you won't get:
- Right-aligned, tabular monospace numbers for the ETH amounts
- The rotated "ink stamp" badges for status (Open/Locked/Resolved/Disputed)

## Optional: the full stamp-badge treatment

If you want the complete effect, and after confirming with whoever owns
`contractService.js` that it's OK to touch, replace `renderBounties()` with:

```js
function renderBounties(bounties) {
    const statusClass = { 0: "stamp-open", 1: "stamp-locked", 2: "stamp-resolved", 3: "stamp-disputed" };
    const rows = bounties.length
        ? bounties.map((b) => `
            <tr>
                <td class="col-id">#${b.id}</td>
                <td class="col-amount">${ethers.formatEther(b.maxBudget)} ETH</td>
                <td><span class="stamp ${statusClass[b.status]}">${BOUNTY_STATUS[b.status]}</span></td>
                <td class="col-addr">${b.client.slice(0, 6)}...${b.client.slice(-4)}</td>
            </tr>`).join("")
        : `<tr class="empty-row"><td colspan="4">No bounties yet — post one to get started.</td></tr>`;

    document.getElementById("feed").innerHTML =
        "<thead><tr><th>ID</th><th>Max Budget</th><th>Status</th><th>Client</th></tr></thead><tbody>" + rows + "</tbody>";
}
```

This is a **pure presentation change** — same data, same function signature,
nothing else in the file needs to move. Safe to hand this exact diff to your
teammate rather than editing their file yourself, if you'd rather they apply it.

## Design tokens, if you want to tweak anything

All colors/fonts live as CSS custom properties at the top of `style.css`:
```css
--paper: #EDEEE9;      /* background */
--ink: #1B1F1D;         /* primary text */
--trust: #1F5C4C;       /* primary green — buttons, Open status */
--danger: #7A3324;      /* Disputed status, danger buttons */
--seal: #A6812E;        /* brass accent — Fund/Resolve buttons, Locked status */
```
