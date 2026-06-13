# AI_USAGE.md

## Tools used

- **Cursor IDE** with Claude (primary development collaborator)
- Used for scaffolding, import logic, UI components, and documentation

## Key prompts

1. *"Build a shared expenses app from this assignment spec with CSV import, anomaly detection, and balance calculation"*
2. *"Analyze expenses_export.csv and identify all deliberate data problems"*
3. *"Implement split types: equal, unequal, percentage, share with proper rounding"*
4. *"Fix date parsing timezone bugs causing off-by-one day errors"*
5. *"Improve fuzzy duplicate detection for Marina Bites and Thalassa entries"*

## Three cases where AI produced something wrong

### 1. Date timezone off-by-one

**What AI did:** Used `new Date(year, month, day)` (local time), then `toISOString()` for comparisons.  
**Symptom:** Feb 1 expenses showed as Jan 31; members flagged as "inactive" incorrectly.  
**How caught:** Import test script showed `INACTIVE_MEMBER_IN_SPLIT` for Aisha on February rent.  
**Fix:** Switched to `Date.UTC(year, month, day, 12)` and string-based `dateKey()` comparisons.

### 2. Duplicate detection missed Marina Bites / Thalassa

**What AI did:** Simple substring matching for fuzzy descriptions.  
**Symptom:** "Dinner at Marina Bites" and "dinner - marina bites" not detected as duplicates.  
**How caught:** Import report showed 0 `POSSIBLE_DUPLICATE` / `CONFLICTING_DUPLICATE` entries.  
**Fix:** Added word-overlap matching (2+ significant words in common, or 1 word when descriptions are short).

### 3. Import module path errors

**What AI did:** Created `src/lib/import/importer.ts` with imports like `./db` instead of `../db`.  
**Symptom:** `npm run build` failed with "Module not found: Can't resolve './db'".  
**How caught:** Production build step in CI/local build.  
**Fix:** Corrected all relative imports to `../db`, `../utils`, `../balances`, `../types`.

## What I verified manually

- Every anomaly type in SCOPE.md traces to code in `src/lib/import/importer.ts`
- Balance calculation in `src/lib/balances.ts` — walked through Rohan's share on a 4-way equal split
- CSV file imported without manual edits (copied as `expenses_export.csv`)
