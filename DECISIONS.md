# DECISIONS — Decision Log

## 1. Tech stack: Next.js full-stack vs separate frontend/backend

**Options:** React + Express, Next.js monolith, Django  
**Chosen:** Next.js 14 App Router with API routes  
**Why:** Single deploy unit, TypeScript end-to-end, fast to ship in 2 days. Prisma works well with Next.js.

## 2. Database: PostgreSQL vs SQLite

**Options:** PostgreSQL only, SQLite for dev + PostgreSQL for prod  
**Chosen:** SQLite locally (PostgreSQL schema documented for production)  
**Why:** Local PostgreSQL credentials unavailable during build. SQLite is still relational. `docker-compose.yml` included for PostgreSQL production.

## 3. Negative amounts: error vs refund

**Options:** Reject, treat as separate refund type, import as negative expense  
**Chosen:** Import as negative expense (Parasailing refund −$30)  
**Why:** Row note says "one slot got cancelled" — clearly a credit. Negative expense reduces group cost and participant shares proportionally.

## 4. Duplicate rows: which wins?

**Options:** Keep first, keep last, keep higher amount, ask user  
**Chosen:** Keep first; flag subsequent duplicates for approval  
**Why:** Meera's requirement — "approve anything the app deletes or changes." First logged entry is default; user approves duplicates.

## 5. Conflicting duplicates (Thalassa ₹2400 vs ₹2450)

**Options:** Keep higher, keep lower, average, ask user  
**Chosen:** Hold both for approval  
**Why:** Notes say "Aisha also logged this I think hers is wrong" — no safe automatic choice.

## 6. Settlement logged as expense

**Options:** Skip, import as expense, convert to settlement  
**Chosen:** Convert to settlement record  
**Why:** "Rohan paid Aisha back" is a payment between two people, not shared spending. Split_with is only Aisha.

## 7. USD conversion rate

**Options:** Live API, fixed rate, user-entered per import  
**Chosen:** Fixed rate via `USD_TO_INR_RATE` env var (default 83.00)  
**Why:** Assignment CSV has no exchange rate column. Fixed rate is transparent and documented. Priya can see original USD + converted INR on each expense.

## 8. Percentages summing to 110%

**Options:** Reject, normalize proportionally, use as-is  
**Chosen:** Normalize proportionally to 100%  
**Why:** Notes say "percentages might be off." Normalizing preserves relative ratios (30:30:30:20 → ~27.3% each for first three, ~18.2% for Meera).

## 9. Unknown participant (Kabir)

**Options:** Create guest member, exclude and redistribute, reject row  
**Chosen:** Exclude Kabir; split among known flatmates only  
**Why:** Kabir is Dev's friend, not a flatmate. Creating a member would affect long-term balances incorrectly.

## 10. Inactive member in split (Meera in April groceries)

**Options:** Include anyway, exclude and redistribute, reject row  
**Chosen:** Exclude inactive members based on join/leave dates; redistribute  
**Why:** Sam's requirement — "Why would March electricity affect my balance?" Same logic: Meera shouldn't be charged after moving out.

## 11. Missing payer

**Options:** Skip, assign to first split member, hold for approval  
**Chosen:** Hold for approval  
**Why:** Notes say "can't remember who paid" — guessing would be wrong.

## 12. Date ambiguity (04-05-2026)

**Options:** DD-MM-YYYY, MM-DD-YYYY, reject  
**Chosen:** Default DD-MM-YYYY (Indian context); flag for user  
**Why:** All flatmates are in India. Deep cleaning on 4 May vs 5 April affects Sam's inclusion — flagged so user can override.

## 13. Rounding rule

**Options:** Round each share, floor + remainder to payer, floor + remainder to last participant  
**Chosen:** Floor division in paise; remainder to last participant  
**Why:** Standard approach (Splitwise-style). Ensures shares sum exactly to total. Documented in `computeSplits()`.

## 14. Split type mismatch (equal + share details)

**Options:** Ignore details, use equal, use share details  
**Chosen:** Use share details when present despite `split_type=equal`  
**Why:** Someone explicitly added shares; the type field is wrong, not the details.

## 15. Zero amount expense

**Options:** Import as ₹0, skip  
**Chosen:** Skip  
**Why:** Note says "counted twice earlier - fixing later" — it's a spreadsheet correction, not real spending.

## 16. Authentication

**Options:** OAuth, magic link, email/password  
**Chosen:** Email/password with bcrypt + NextAuth JWT  
**Why:** Simplest self-contained auth for assignment scope.

## 17. Approval workflow

**Options:** Auto-approve all, block entire import, per-anomaly approval  
**Chosen:** Per-anomaly approval for `pending_approval` items only  
**Why:** Meera wants control over deletions/changes without blocking the entire import.
