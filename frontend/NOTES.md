# What I added, and how to merge it into your teammate's work

## Files that are safe to drop in as-is (they're brand new, filling empty stubs)
- `js/ipfsHelper.js` — was an empty stub, now has the full Pinata pipeline
- `js/formActions.js` — new file, holds the write actions NOT already in
  `contractService.js` (register, post bounty, submit bid, submit work,
  approve work, raise dispute, resolve dispute, plus the freelancer-dropdown
  helper for the escrow form)
- `js/ui.js` — was an empty stub, now has role-based dashboard rendering
  (Client / Freelancer / Arbiter) and populates all the bounty-ID dropdowns
- `js/eventListeners.js` — was an empty stub, now has Checkpoint 5's live
  `contract.on(...)` handlers
- `js/app.js` — was an empty stub, now binds every button and waits for
  `contractService.js`'s own `initConnection()` to finish before wiring
  anything up

## Files I did NOT touch
- `js/config.js` — left completely as-is, your teammate's `CONTRACT_ADDRESS`
  and `CONTRACT_ABI` are untouched
- `js/contractService.js` — left completely as-is. `fundEscrow()` and
  `claimFunds()` already existed there and are reused directly, not
  duplicated. `js/wallet.js` and `js/eventListeners.js` in the repo were
  empty (0 bytes) — `eventListeners.js` is now filled in above;
  `wallet.js` is unused since `contractService.js` already owns wallet
  connection.

## The one file that changed structurally
- `index.html` — expanded from the 8-line minimal version to include all
  the role-based forms. **The original `<h3 id="status">` and
  `<table id="feed">` elements are preserved with the same IDs**, so
  `contractService.js`'s `renderBounties()` and the status-text line in
  `initConnection()` still work exactly as your teammate wrote them —
  nothing in their file needed to change.

## Fill in before running
1. `js/ipfsHelper.js` → `PINATA_JWT`
2. `js/config.js` → `CONTRACT_ADDRESS` (already has one from a previous
   local deploy — update it if you redeploy on your machine, since Anvil
   addresses are only guaranteed the same on a **freshly restarted** node's
   *first* deploy)

## How everything connects (script load order matters)
```
ethers (CDN)
config.js          -> CONTRACT_ADDRESS, CONTRACT_ABI, ROLE, BOUNTY_STATUS
contractService.js -> connects wallet, defines contract, fetch*, render*, fundEscrow, claimFunds
                       (also self-starts: initConnection().then(() => loadFeed()))
ipfsHelper.js       -> uploadFileToIPFS, uploadJSONToIPFS
formActions.js      -> registerUser, postBounty, submitBid, submitWork,
                        approveWork, raiseDispute, resolveDispute, submitFundEscrow
ui.js               -> renderDashboard, populateBountySelects
eventListeners.js   -> subscribeToEvents (Checkpoint 5)
app.js              -> waits for `contract` to exist, then calls
                        renderDashboard() + subscribeToEvents() + binds all buttons
```

## Before pushing
Talk to whoever wrote `contractService.js` first — since you didn't edit
their file, this should merge cleanly, but it's worth confirming they're
not also mid-way through adding UI code that would now duplicate yours.
