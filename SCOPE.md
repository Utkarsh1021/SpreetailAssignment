# SCOPE — Anomaly Log & Database Schema

## CSV Anomalies (18 deliberate problems found)

| # | Row | Type | Detection | Policy |
|---|-----|------|-----------|--------|
| 1 | 6 | **Duplicate expense** | Same date, amount, fuzzy-matched description ("Dinner at Marina Bites" / "dinner - marina bites") | Hold row 6 for Meera's approval; row 5 imports |
| 2 | 7 | **Comma-formatted amount** | `"1,200"` contains comma | Strip commas, parse as 1200 |
| 3 | 9 | **Case inconsistency** | Payer `priya` | Normalize to canonical `Priya` |
| 4 | 11 | **Name alias** | Payer `Priya S` | Map to `Priya` via alias table |
| 5 | 13 | **Missing payer** | Empty `paid_by` | Hold for approval; user must assign payer |
| 6 | 14 | **Settlement as expense** | Description + notes mention "paid back" / "settlement" | Convert to Settlement record (Rohan → Aisha ₹5000) |
| 7 | 15, 32 | **Percentage mismatch** | Splits sum to 110% (30+30+30+20) | Normalize proportionally to 100% |
| 8 | 20–23, 26 | **Foreign currency (USD)** | `currency=USD` | Convert at `USD_TO_INR_RATE` (83.00); store original + INR |
| 9 | 22 | **Share split** | `split_type=share` with share counts | Split by share ratio; remainder to last participant |
| 10 | 23 | **Unknown participant** | `Dev's friend Kabir` not in group | Exclude; redistribute among known members |
| 11 | 24–25 | **Conflicting duplicate** | Same event (Thalassa), different amounts (₹2400 vs ₹2450) | Both held for approval |
| 12 | 26 | **Negative amount (refund)** | `-30 USD` | Import as negative expense (credit) |
| 13 | 27 | **Alternate date format** | `Mar-14` | Parse as 14-Mar-2026 |
| 14 | 27 | **Trailing whitespace** | Payer `rohan ` | Trim and normalize |
| 15 | 28 | **Missing currency** | Empty currency field | Default to INR with warning |
| 16 | 31 | **Zero amount** | `amount=0` with note "counted twice" | Skip row |
| 17 | 34 | **Ambiguous date** | `04-05-2026` (April 5 vs May 4) | Flag; default DD-MM-YYYY (Indian format) |
| 18 | 36 | **Inactive member in split** | Meera listed on April 2 expense after leaving Mar 31 | Remove Meera; redistribute among active members |
| 19 | 42 | **Split type mismatch** | `equal` but share details provided | Use share split from details |
| 20 | 10 | **Decimal precision** | `899.995` | Round to 900.00 |

Additional informational flags: `AMBIGUOUS_DATE` on any DD-MM-YYYY date where both parts ≤ 12.

---

## Database Schema

```
User
  id, email, passwordHash, name, createdAt

Group
  id, name, description, baseCurrency, createdById, createdAt

GroupMember
  id, groupId, userId?, displayName, joinedAt, leftAt?
  — Temporal membership: Sam joined 2026-04-08, Meera left 2026-03-31

Expense
  id, groupId, date, description, paidByMemberId?, amountOriginal,
  currency, amountInINR, exchangeRate?, splitType, notes, status,
  importRowNumber?, importSessionId?, createdAt

ExpenseSplit
  id, expenseId, memberId, shareAmount, shareValue?

Settlement
  id, groupId, fromMemberId, toMemberId, amount, date, notes,
  importRowNumber?, createdAt

ImportSession
  id, groupId, filename, status, summary?, createdAt

ImportAnomaly
  id, importSessionId, rowNumber, anomalyType, description, action,
  actionDetail?, rawRow, requiresApproval, approved?, approvedAt?
```

### Key relationships

- Group → many GroupMembers, Expenses, Settlements, ImportSessions
- Expense → many ExpenseSplits (one per participant)
- ImportSession → many ImportAnomalies (audit trail for every detected issue)

### Balance calculation

For each member: `netBalance = totalPaid − totalOwed`

- `totalPaid` = sum of expenses where member is payer + settlements sent
- `totalOwed` = sum of ExpenseSplit.shareAmount + settlements received

Settlement suggestions use greedy minimal-cash-flow algorithm.
