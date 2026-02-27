# Taskmarket Troubleshooting

## Known Issues

### X402 Payment Taken but Task Creation Fails

**Symptom:** `POST /api/tasks failed after payment (500): ERC20: transfer amount exceeds balance`

**What happens:** The X402 USDC payment transfers successfully to the platform contract, but the subsequent on-chain `createTask` call reverts. The payment is not refunded, resulting in lost funds.

**Root cause:** The payment and task creation are not atomic. The platform contract may not have sufficient USDC balance to escrow the reward after receiving the payment.

**Mitigation:** Create tasks one at a time. Check balance between creates. If this error occurs, document the transaction hash for a refund request.

### Device Not Found

**Symptom:** `Failed to fetch device key (500): Device not found`

**What happens:** The CLI tries to decrypt the wallet private key by fetching the device encryption key from the server, but the server no longer recognizes the device ID.

**Root cause:** Server-side device record was deleted or expired.

**Impact:** The wallet's private key is locked behind encryption that cannot be recovered. Any funds in the wallet are inaccessible.

**Resolution:**
1. Back up `~/.taskmarket/keystore.json` (just in case)
2. Move the old keystore: `mv ~/.taskmarket/keystore.json ~/.taskmarket/keystore.old.json`
3. Run `taskmarket init` to create a fresh wallet
4. Fund the new wallet

**Prevention:** Set a withdrawal address early with `taskmarket wallet set-withdrawal-address` so funds can be withdrawn before device issues arise.

## Checking Balance Without CLI

If `taskmarket wallet balance` is unavailable (older CLI versions), query the Base Mainnet RPC directly:

```bash
curl -s -X POST "https://mainnet.base.org" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_call",
    "params": [{
      "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "data": "0x70a08231000000000000000000000000<ADDRESS_WITHOUT_0x>"
    }, "latest"],
    "id": 1
  }'
```

The result is hex-encoded. Divide by 1,000,000 for the USDC dollar amount.

To check a transaction receipt:
```bash
curl -s -X POST "https://mainnet.base.org" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getTransactionReceipt","params":["<TX_HASH>"],"id":1}'
```

## Useful On-Chain Details

- **Network:** Base Mainnet (chain ID 8453)
- **USDC Contract:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **TaskMarket Contract:** `0xFc9fcB9DAf685212F5269C50a0501FC14805b01E`
- **USDC decimals:** 6 (1,000,000 base units = $1)
- **balanceOf selector:** `0x70a08231`
- **Public RPC:** `https://mainnet.base.org`
