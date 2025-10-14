# Institutional Upgrade - Quick Reference

## **What Changed?**

### **1. ONE Pattern Rule** ✅
- System now shows ONLY institutional OR candidate (never both)
- If institutional exists → candidate is hidden
- If no institutional → shows candidate (max 1)

### **2. Direction Consistency** ✅
- All labels now use `executionDirection` (not legacy `riskManagement.direction`)
- Header, verdict, recommendations all match
- Example: Bearish Double Top → "📉 SHORT Setup" everywhere

### **3. Scoring Rules** ✅
```
With Chart Pattern:
  Base = 60% chart + 40% candle
  + Bonuses (alignment, breakout, volume)
  - Penalties (opposition)
  Cap at 95

Without Chart Pattern (Candle-Only):
  Base = candle score
  Cap at 55 (no structure)
  
Candidate:
  Cap at 65 (not institutional)
```

### **4. Recommendations Match Direction** ✅
```
Bullish Direction:
  76+ → "Strong Buy"
  61+ → "Buy"
  41+ → "Watch"
  <41 → "Pass"

Bearish Direction:
  76+ → "Strong Short"
  61+ → "Short"
  41+ → "Watch"
  <41 → "Pass"
```

### **5. UI Changes** ✅
- Header: Uses `executionDirection`
- Verdict: Shows pattern source (institutional/candidate/candle-only)
- Pattern Display: Only ONE pattern shown
- Candidate Notice: "⚠️ No institutional pattern detected" added

### **6. Data Freshness** ✅
- Updated for Polygon Stocks Starter (15-min delayed)
- Clear, concise messaging
- Shows: Data source, last bar date, confirmation requirement

---

## **How to Verify Fix**

### **PLTR Test (Bearish Double Top + Bullish Hammer)**
**Expected:**
- ✅ Header: "📉 SHORT Setup"
- ✅ Pattern: Double Top (Institutional only, no candidate shown)
- ✅ Recommendation: "Short" or "Watch" (not "Strong Short" if opposition penalty)
- ✅ Verdict: "Institutional short setup ready..."
- ✅ All labels say "short" or "bearish"

**Before (WRONG):**
- ❌ Header: "📈 LONG Setup"
- ❌ Shows BOTH Double Top AND Double Bottom
- ❌ Recommendation: "Strong Short" but labeled LONG
- ❌ Verdict: "Institutional long setup"

---

## **Quick Debug Checklist**

If you see contradictions:

1. **Check Console Logs:**
   ```
   [Analyze] Direction from INSTITUTIONAL: Double Top (bearish)
   [Analyze] Setup score: XX/100 (rating) - bearish direction
   ```

2. **Check Report Fields:**
   ```typescript
   report.executionDirection // Should match pattern type
   report.patternSource      // 'institutional', 'candidate', or 'candle-only'
   ```

3. **Check Pattern Counts:**
   ```typescript
   report.patternV2.institutional // Should be present OR null
   report.patternV2.candidate     // Should be present OR null (never both)
   ```

4. **Check UI Rendering:**
   - Only ONE chart pattern section should render
   - Candidate should show "No institutional" notice
   - Header/verdict should match pattern direction

---

## **Grade Mapping**

```
90+  = A+
76-89 = A
61-75 = B
41-60 = C
0-40  = D
```

**Caps:**
- Institutional: 95 max (hard cap)
- Candidate: 65 max
- Candle-only: 55 max

---

## **Pattern Source Labels**

```typescript
"institutional" → Strict criteria met, tradeable
"candidate"     → Nearly meets criteria, capped at 65
"candle-only"   → No chart pattern, capped at 55
```

---

## **Verdict Examples**

### **Institutional Ready:**
```
"Institutional short setup ready for execution. 
Entry trigger: $172.58 with adequate volume confirmation."
```

### **Candidate:**
```
"Candidate short setup (capped at 65 until confirmed). 
Wait for breakdown at $18.76 with volZ ≥ 0 before entry. 
Institutional grade = Pending (see unmet criteria above)."
```

### **Candle-Only:**
```
"Candle-only short signal (capped at 55 - no structure). 
Entry trigger: $XX.XX. Monitor for pattern development."
```

---

## **Files Modified**

1. `lib/patterns/detector-v2.ts` - ONE pattern rule
2. `app/api/analyze/route.ts` - Direction + source tracking
3. `lib/scoring/rating.ts` - Institutional scoring
4. `app/analyze-client.tsx` - UI consistency

---

## **Testing Commands**

```bash
# Test with specific tickers
npm run dev

# Navigate to:
http://localhost:3000

# Test scenarios:
1. PLTR (bearish Double Top with opposition)
2. LYFT (candidate pattern)
3. SOFI (candle-only)
4. NFLX (aligned bullish)
```

---

## **Common Issues & Fixes**

### **Issue: Shows both institutional and candidate**
**Fix:** Check `detector-v2.ts` line 66-74, ensure candidate is NULL when institutional exists

### **Issue: Header says LONG but pattern is bearish**
**Fix:** Check `analyze-client.tsx` line 200, should use `report.executionDirection`

### **Issue: Recommendation doesn't match direction**
**Fix:** Check `rating.ts` line 307-320, should use `executionDirection` parameter

### **Issue: Verdict contradicts setup**
**Fix:** Check `analyze-client.tsx` line 866-892, should use `report.executionDirection` and `report.patternSource`

---

**Status:** ✅ **ALL FIXED** - System now consistent and institutional-grade!
