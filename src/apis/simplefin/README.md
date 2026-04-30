# SimpleFIN API handler

**Version:** 2

## Getting started

SimpleFIN uses a one-time **SimpleFIN Token** to establish a permanent connection. The token is exchanged for an **Access URL**, which is stored locally and used for all subsequent requests.

### 1. Generate a SimpleFIN Token

Visit your financial institution's SimpleFIN Server, or use the [SimpleFIN Bridge](https://bridge.simplefin.org/simplefin/create) if your institution does not host one. Follow the prompts to create a SimpleFIN Token and copy it to your clipboard.

### 2. Claim the Access URL

Run the setup command, passing in the SimpleFIN Token:

```bash
pdpl simplefin:setup <SIMPLEFIN_TOKEN>
```

This command decodes the token, makes a one-time POST to claim the Access URL, and writes `SIMPLEFIN_ACCESS_URL` to your `~/.pdpl/.env` file automatically.

> **Security note:** If the claim request returns a 403 error, the token may have already been used by someone else. Treat this as a potential compromise and revoke the token at your institution immediately.

### 3. Configure PDPL

Add `simplefin` to your PDPL configuration file:

```js
// ~/.pdpl/config.js
export default {
  apis: {
    simplefin: true,
  },
};
```

### 4. Run the pipeline

```bash
pdpl api:get simplefin
```

## Data collected

| Directory | Type | Description |
|---|---|---|
| `simplefin/accounts` | Snapshot | Account balances fetched daily (no transaction data) |
| `simplefin/accounts--transactions` | Chronological | Transactions flattened across all accounts, grouped by posted date |

Each transaction entity is annotated with an `account_id` field for easy cross-referencing.

## Revoking access

To revoke PDPL's access to your financial data, log in to your institution's portal (or the [SimpleFIN Bridge](https://bridge.simplefin.org)) and disable the connection. Remove `SIMPLEFIN_ACCESS_URL` from your `~/.pdpl/.env` file afterward.

## Resources

- [SimpleFIN Protocol](https://www.simplefin.org/protocol.html)
- [SimpleFIN Bridge](https://bridge.simplefin.org)
