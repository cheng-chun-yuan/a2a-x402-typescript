# AML Compliance

## Sanctions List Configuration

The `sanctions-list.json` file allows you to define custom sanctioned addresses that will be checked in addition to the Chainalysis Oracle.

### Adding Custom Addresses

Edit `sanctions-list.json` to add addresses you want to block:

```json
{
  "description": "Custom sanctioned wallet addresses",
  "lastUpdated": "2025-10-28",
  "sources": [
    "Your source here (e.g., Internal compliance, OFAC list, etc.)"
  ],
  "addresses": [
    "0x1234567890abcdef1234567890abcdef12345678",
    "0xabcdef1234567890abcdef1234567890abcdef12"
  ]
}
```

### How It Works

The AML system checks **BOTH** sources for every transaction:

1. **Chainalysis Oracle** (Ethereum Mainnet)
   - Real-time OFAC sanctions screening
   - Automatically updated by Chainalysis
   - Free to use
   - Checked first

2. **Local Custom List** (sanctions-list.json)
   - Your custom sanctioned addresses
   - Additional addresses beyond OFAC
   - Always checked after Oracle
   - Works as fallback if Oracle fails

**Result**: An address is **BLOCKED** if it appears in **EITHER** the Oracle **OR** your custom list.

### Common Use Cases

#### Block Specific Addresses
```json
{
  "description": "Blocked addresses from internal compliance",
  "addresses": [
    "0x...",  // Fraud case #123
    "0x..."   // High-risk customer
  ]
}
```

#### Add Public Sanctions Lists
```json
{
  "description": "OFAC SDN List addresses",
  "sources": ["OFAC", "UN Sanctions"],
  "addresses": [
    "0x7F367cC41522cE07553e823bf3be79A889DEbe1B",  // Tornado Cash
    "0x..."  // Other sanctioned addresses
  ]
}
```

### Updating the List

The local list is loaded once when the AML system initializes. To update:

1. Edit `sanctions-list.json`
2. Restart your application
3. Changes take effect immediately

### Security Notes

- **Keep this file secure** - Contains sensitive compliance data
- **Do not commit real sanctions lists to public repos**
- **Validate addresses** - Ensure they are valid Ethereum addresses
- **Document sources** - Track where each address came from

### Resources

- [OFAC Sanctions List](https://sanctionssearch.ofac.treas.gov/)
- [Chainalysis Oracle Docs](https://go.chainalysis.com/chainalysis-oracle-docs.html)
- [Ethereum Address Checksum](https://etherscan.io/address-validator)
