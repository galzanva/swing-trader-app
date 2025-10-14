# QA Checklist – Quick Reference

## 🎯 Pass/Fail Criteria

### **✅ PASS Requirements:**
- Score ≥ 80/100
- Zero Critical Issues
- Zero High-Priority Issues
- All sections consistent
- Institutional verdict present

### **❌ FAIL Triggers:**
- Score < 80/100
- Any Critical Issues
- Multiple High-Priority Issues
- Direction contradictions
- Missing verdict

---

## 📋 8 Major Categories

### **1. Section Consistency** (5 checks)
- Grade matches score
- Direction aligned
- Data consistent

### **2. Pattern Accuracy** (6 checks)
- Confidences labeled separately
- Candidate has unmet criteria
- Next Steps specific
- Confidence ≤ 95%

### **3. Execution Plan** (10 checks)
- Confirmation-based entry
- Numbers match everywhere
- Percentages shown
- Viability Index (0.5-2.5)
- Volume penalty applied
- Verdict present

### **4. Volume & Trend** (7 checks)
- Counter-trend labeled
- Volume warnings
- EMA calculation accurate
- "Need avg+ volume" shown

### **5. Composite Scoring** (4 checks)
- Formula explained
- Candidate cap (≤65)
- Sub-scores sum correctly
- Breakdown matches

### **6. Mentor Notes** (8 checks)
- Uses Execution Plan numbers
- 3-5 concise bullets
- No contradictions
- Actionable, not speculative

### **7. Readability** (6 checks)
- No speculative words
- Clear guidance
- Definitive tone
- Strategic emojis

### **8. Optional Enhancements** (4 checks)
- Volume tooltip
- ATR ratios
- Earnings proximity
- Colored indicators

---

## ⚠️ Issue Severity

| Severity | Points | Examples |
|----------|--------|----------|
| 🔴 Critical | -20 | Grade mismatch, Candidate > 65 |
| 🟠 High | -10 | Direction mismatch, Missing criteria |
| 🟡 Medium | -5 | Confidence > 95%, Missing % |
| 🔵 Low | -2 | Minor formatting |
| ⚠️ Warning | -1 | Suggestions |

---

## 🔧 Key Rules

### **Confidence Caps:**
```
All confidences: Max 95%
Candidate composite: Max 65
Blocked composite: Max 40
```

### **Volume Impact:**
```
volZ < -0.5 → ×0.5 penalty
volZ > +0.3 → ×1.25 bonus
Viability Index: 0.5–2.5
```

### **Counter-Trend:**
```
Short + Price > EMA200 = Counter-trend
Long + Price < EMA200 = Counter-trend
→ Must have warning
```

### **Mentor Notes:**
```
Bullets: 3-5 optimal, 8 max
Price: Must match Execution Plan
Tone: "Wait for" not "May"
No speculative words
```

---

## 📊 Score Ranges

| Score | Grade | Status |
|-------|-------|--------|
| 95-100 | A+ | Perfect |
| 85-94 | A | Excellent |
| 80-84 | B+ | Good ✅ PASS |
| 70-79 | B | Acceptable |
| 60-69 | C | Needs work |
| < 60 | F | Failing ❌ FAIL |

---

## 🚀 Quick Fixes

### **If Score < 80:**
1. Check for Critical/High issues first
2. Fix direction mismatches
3. Verify candidate caps
4. Ensure numbers match across sections

### **If Warnings > 5:**
1. Simplify Mentor Notes (3-5 bullets)
2. Add volume warnings for volZ < 0
3. Add counter-trend labels
4. Use definitive language

### **If Viability Index Wrong:**
1. Check volume multiplier applied
2. Verify volZ < -0.5 → ×0.5
3. Ensure clamped 0.5-2.5
4. Add visual penalty indicator

---

## 💡 Common Issues

### **Critical (Must Fix):**
- ❌ Candidate score > 65
- ❌ Grade doesn't match score
- ❌ Direction mismatch

### **High (Fix Soon):**
- ❌ Candidate missing unmet criteria
- ❌ Mentor Notes contradict direction
- ❌ Missing institutional verdict

### **Medium (Fix Next):**
- ⚠️ Confidence > 95%
- ⚠️ Missing percentages
- ⚠️ EMA calculation off

### **Low (Polish):**
- ℹ️ Formatting inconsistencies
- ℹ️ Minor label issues

---

## 🎯 Perfect Report Checklist

- [ ] Score ≥ 80/100
- [ ] Grade matches score numerically
- [ ] Direction consistent everywhere
- [ ] Entry ≠ current price (confirmation-based)
- [ ] All % moves shown
- [ ] Viability Index 0.5-2.5
- [ ] Volume penalty/bonus applied
- [ ] Counter-trend labeled (if applicable)
- [ ] Candidate ≤ 65 (if not institutional)
- [ ] Mentor Notes use Execution Plan numbers
- [ ] 3-5 concise bullets
- [ ] No speculative language
- [ ] Institutional verdict present
- [ ] All confidences ≤ 95%
- [ ] Composite formula shown
- [ ] Volume warnings for volZ < 0

---

## 📝 Logging Format

```
[QA] Score: 92/100 - PASSED
[QA] Issues: 2
  - [MEDIUM] Pattern: Confidence 96% > 95%
  - [LOW] Readability: Speculative: "may"
[QA] Warnings: 3
  - Volume: Missing warning
  - Mentor: Too verbose (12 bullets)
  - Viability: High despite low volume
```

---

## 🎉 Quick Win Tips

1. **Always check:**
   - Grade = getExpectedGrade(score)
   - Entry ≠ currentPrice
   - Candidate ≤ 65
   - Viability 0.5-2.5

2. **Easy fixes:**
   - Cap all confidences at 95%
   - Add "Wait for" instead of "May"
   - Show all % moves
   - 3-5 bullets max in Mentor Notes

3. **Pro moves:**
   - Add volume penalty indicators
   - Label counter-trend clearly
   - Show composite formula
   - Include institutional verdict

**Use this guide to ensure every report passes QA!** ✅
