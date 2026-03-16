/**
 * LLM Analyzer - AI-powered analysis generation using the configured LLM provider
 */

import { callLLM } from './client';

export class LLMAnalyzer {
  constructor(_apiKey?: string) {
    // API key now resolved from env via lib/llm/config.ts
  }

  /**
   * Generate composite analysis with the configured LLM
   */
  async generateCompositeAnalysis(
    symbol: string,
    timeframe: string,
    indicators: any,
    compositePattern: any,
    score: any,
    riskPlan: any,
    executionPlan: any,
    squeezeAnalysis?: any,
    fundamentals?: any,
    newsSummary?: any,
    displayScore?: number  // Optional: the actual score shown in UI (mainScore)
  ): Promise<{
    narrative: string;
    mentorNotes: string;
    reasoning: string[];
    warnings: string[];
    strengths: string[];
    ratingAdjustment?: {
      adjustedScore: number;
      adjustedRating: 'A+' | 'A' | 'B' | 'C' | 'D';
      reason: string;
    };
  }> {
    try {
      // Build comprehensive context for LLM
      const context = this.buildAnalysisContext(
        symbol,
        timeframe,
        indicators,
        compositePattern,
        score,
        riskPlan,
        executionPlan,
        squeezeAnalysis,
        fundamentals,
        newsSummary,
        displayScore  // Pass the display score
      );

      const result = await callLLM({
        messages: [
          {
            role: 'system',
            content: `You are an expert swing trading mentor with expertise in technical analysis and fundamentals. Provide concise, actionable analysis focused on:
1. WHY the setup is tradeable (or not) - analyze market structure, not just criteria
2. SPECIFIC entry tactics and risk management
3. KEY factors traders should watch
4. Squeeze dynamics (short interest + volatility compression)
5. Real-world execution considerations

🚨 CRITICAL: STRUCTURED SCORE EXPLANATION REQUIRED 🚨
You MUST start your analysis with this EXACT structure to clearly distinguish technical vs holistic scoring:

📊 Technical Score: [X]/100 ([RATING])
Based purely on technical indicators, chart patterns, and price action.

🤖 AI Holistic Assessment: [Y]/100 ([RATING]) [⬆️ or ⬇️ or ➡️] ([+/-Z points])

Factor Analysis (breakdown of adjustments):
• Fundamentals: [impact description] [[+/-N points]]
• Sentiment: [impact description] [[+/-N points]]
• Squeeze Dynamics: [impact description] [[+/-N points]]

Final Assessment: [1-2 sentences explaining the overall adjustment reasoning]

---

Then continue with your regular sections:
**Market Structure & Setup Quality**
**Entry Tactics & Risk Management**
**Key Factors to Monitor**

🚨 ADJUSTMENT RULES 🚨
- You can adjust the technical score by ±15 points maximum (±1 full grade)
- Technical score is provided in the context (e.g., "40/100 D rating")
- Grade boundaries: 0-40=D, 41-60=C, 61-75=B, 76-89=A, 90+=A+
- UPGRADE if: strong fundamentals + positive catalysts + favorable sentiment outweigh weak technicals
- DOWNGRADE if: fundamental risks + negative catalysts + adverse sentiment override strong technicals
- NO CHANGE (➡️) if: factors are balanced or technical score is already appropriate
- Factor points should sum approximately to your total adjustment

🚨 LEGACY RATING_ADJUSTMENT FORMAT (STILL SUPPORTED) 🚨
After your structured explanation, you may OPTIONALLY include this line for system processing:
RATING_ADJUSTMENT: [new_score]/100 [new_rating] - [one sentence reason]

If you use the structured format above correctly, this line is optional but recommended for validation.

Be direct and practical. Avoid repeating obvious criteria. Focus on insights a trader can act on.`
          },
          {
            role: 'user',
            content: context
          }
        ],
        temperature: 0.7,
        maxTokens: 800,
      });

      const analysis = result.content;

      // Parse LLM response
      return this.parseAnalysisResponse(analysis, indicators, squeezeAnalysis, score, compositePattern);
      
    } catch (error: any) {
      console.error('[LLM] Error generating analysis:', error?.message ?? error);
      return this.generateFallbackAnalysis(symbol, timeframe, indicators, compositePattern, score, squeezeAnalysis);
    }
  }

  /**
   * Build comprehensive context string for LLM
   */
  private buildAnalysisContext(
    symbol: string,
    timeframe: string,
    indicators: any,
    compositePattern: any,
    score: any,
    riskPlan: any,
    executionPlan: any,
    squeezeAnalysis?: any,
    fundamentals?: any,
    newsSummary?: any,
    displayScore?: number  // The ACTUAL score shown in header (mainScore)
  ): string {
    // Use displayScore if provided, otherwise fall back to score.overall
    const getRatingFromScore = (s: number) => (s >= 90 ? 'A+' : s >= 76 ? 'A' : s >= 61 ? 'B' : s >= 41 ? 'C' : 'D');
    const technicalScore = displayScore !== undefined ? displayScore : score.overall;
    const technicalRating = getRatingFromScore(technicalScore);
    
    // START WITH THE SCORE - MOST IMPORTANT
    // CRITICAL: Use the SAME score that's displayed in the header (mainScore)
    let context = `**CRITICAL: USE THIS EXACT TECHNICAL SCORE AS YOUR STARTING POINT:**\n`;
    context += `📊 Technical Score (from patterns + indicators): ${technicalScore}/100 (${technicalRating} rating)\n`;
    context += `\n`;
    context += `This is the TECHNICAL SCORE you MUST use in your "📊 Technical Score" section.\n`;
    context += `You may adjust it by ±15 points for your "🤖 AI Holistic Assessment" based on fundamentals/sentiment/squeeze, but the TECHNICAL score stays ${technicalScore}/100.\n`;
    context += `DO NOT make up a different technical score. The technical score is ${technicalScore}/100 (${technicalRating}).\n\n`;
    
    context += `Analyze ${symbol} on ${timeframe} timeframe:\n\n`;
    
    // Technical setup
    context += `**Technical Setup:**\n`;
    context += `- Pattern: ${compositePattern.candlestickPattern.name} (${compositePattern.candlestickPattern.confidence}% confidence)\n`;
    if (compositePattern.chartPattern) {
      context += `- Chart Structure: ${compositePattern.chartPattern.name} (${compositePattern.chartPattern.confidence}%)\n`;
    }
    context += `- Trend: ${indicators.trend}, Strength: ${indicators.strength}\n`;
    const rsiSafe = typeof indicators.rsi === 'number' ? indicators.rsi : Number(indicators.rsi ?? 0);
    const volZSafe = typeof indicators.volumeZScore === 'number' ? indicators.volumeZScore : Number(indicators.volumeZScore ?? 0);
    const ema9Safe = typeof indicators.ema9 === 'number' ? indicators.ema9 : Number(indicators.ema9 ?? 0);
    const ema20Safe = typeof indicators.ema20 === 'number' ? indicators.ema20 : Number(indicators.ema20 ?? 0);
    const ema50Safe = typeof indicators.ema50 === 'number' ? indicators.ema50 : Number(indicators.ema50 ?? 0);
    context += `- RSI: ${rsiSafe.toFixed(1)}, Volume Z: ${volZSafe.toFixed(2)}\n`;
    context += `- EMAs: 9(${ema9Safe.toFixed(2)}), 20(${ema20Safe.toFixed(2)}), 50(${ema50Safe.toFixed(2)})\n`;
    context += `- Overall Score: ${score.overall}/100 (${score.rating})\n\n`;

    // Squeeze analysis (if available)
    if (squeezeAnalysis && squeezeAnalysis.combinedPotential && squeezeAnalysis.combinedPotential !== 'none') {
      const sq = squeezeAnalysis;
      context += `**Squeeze Dynamics:**\n`;
      context += `- Combined Potential: ${sq.combinedPotential.toUpperCase()} (Score: ${sq.combinedScore}/100)\n`;
      
      if (sq.shortSqueeze && sq.shortSqueeze.potential !== 'none') {
        context += `- Short Interest: ${sq.shortSqueeze.potential} potential\n`;
        if (typeof sq.shortSqueeze.daysToCover === 'number') context += `  • Days to Cover: ${sq.shortSqueeze.daysToCover.toFixed(1)}\n`;
        if (typeof sq.shortSqueeze.shortFloat === 'number') context += `  • Short Float: ${sq.shortSqueeze.shortFloat.toFixed(1)}%\n`;
        if (typeof sq.shortSqueeze.shortVolumeZ === 'number') context += `  • Volume Z-Score: ${sq.shortSqueeze.shortVolumeZ.toFixed(2)}\n`;
      }
      
      if (sq.ttmSqueeze && sq.ttmSqueeze.current && sq.ttmSqueeze.current.state !== 'OFF') {
        const durationSafe = typeof sq.ttmSqueeze.squeezeDuration === 'number' ? sq.ttmSqueeze.squeezeDuration : Number(sq.ttmSqueeze.squeezeDuration ?? 0);
        const momStrSafe = typeof sq.ttmSqueeze.momentumStrength === 'number' ? sq.ttmSqueeze.momentumStrength : Number(sq.ttmSqueeze.momentumStrength ?? 0);
        context += `- TTM Squeeze: ${sq.ttmSqueeze.current.state} for ${durationSafe} bars\n`;
        if (sq.ttmSqueeze.momentumDirection) {
          context += `  • Momentum: ${sq.ttmSqueeze.momentumDirection} (${momStrSafe.toFixed(0)}%)\n`;
        }
        if (sq.ttmSqueeze.fireConfirmed) context += `  • 🔥 FIRE CONFIRMED - Breakout detected!\n`;
      }
      
      if (sq.alignment) {
        context += `- ⚡ BOTH SQUEEZES ALIGNED - Enhanced breakout potential\n`;
      }
      context += `\n`;
    }

    // Risk/Reward
    context += `**Risk Profile:**\n`;
    context += `- Direction: ${riskPlan.direction.toUpperCase()}\n`;
    // Use riskReward.target1 as the primary R:R ratio
    const rrSafe = typeof riskPlan.riskReward?.target1 === 'number' ? riskPlan.riskReward.target1 : 0;
    const riskPercSafe = typeof riskPlan.riskPercent === 'number' ? riskPlan.riskPercent : 0;
    context += `- R:R Ratio: ${rrSafe.toFixed(2)}:1 (Target 1)\n`;
    context += `- Risk: ${riskPercSafe.toFixed(1)}% from entry to stop\n\n`;

    // Execution context
    if (executionPlan.warnings && executionPlan.warnings.length > 0) {
      context += `**Execution Concerns:**\n`;
      executionPlan.warnings.forEach((w: string) => context += `- ${w}\n`);
      context += `\n`;
    }

    // Comprehensive Fundamentals (Finnhub) + Industry Context
    if (fundamentals && fundamentals.qualityScore !== undefined) {
      const industry = fundamentals.profile?.industry || 'Unknown';
      const sector = fundamentals.profile?.sector || 'Unknown';
      context += `**Company & Industry Context:**\n`;
      context += `- Sector: ${sector} | Industry: ${industry}\n`;
      context += `- Use industry-aware interpretation (e.g., high P/E acceptable for hypergrowth software; low margins typical in retail). If industry is Unknown, default to broad-market norms.\n\n`;
      context += `**Comprehensive Fundamental Analysis (Finnhub):**\n`;
      context += `- Quality Score: ${fundamentals.qualityScore}/100 (${fundamentals.quality.grade})\n`;
      context += `- Viability Score: ${fundamentals.viabilityScore}/100 (${fundamentals.viability.valuation})\n`;
      context += `- Risk Score: ${fundamentals.riskScore}/100 (${fundamentals.risk.level} risk)\n\n`;
      
      context += `**Quality Factors:**\n`;
      if (fundamentals.quality.roe !== null) context += `- ROE: ${fundamentals.quality.roe.toFixed(1)}%\n`;
      if (fundamentals.quality.operatingMargin !== null) context += `- Operating Margin: ${fundamentals.quality.operatingMargin.toFixed(1)}%\n`;
      if (fundamentals.quality.fcfMargin !== null) context += `- FCF Margin: ${fundamentals.quality.fcfMargin.toFixed(1)}%\n`;
      context += `- ${fundamentals.quality.summary}\n\n`;
      
      context += `**Viability & Valuation:**\n`;
      if (fundamentals.viability.pe !== null) context += `- P/E Ratio: ${fundamentals.viability.pe.toFixed(1)}\n`;
      if (fundamentals.viability.pb !== null) context += `- P/B Ratio: ${fundamentals.viability.pb.toFixed(2)}\n`;
      if (fundamentals.viability.revenueGrowth !== null) context += `- Revenue Growth: ${fundamentals.viability.revenueGrowth > 0 ? '+' : ''}${fundamentals.viability.revenueGrowth.toFixed(1)}%\n`;
      if (fundamentals.viability.analystRating !== 'unknown') context += `- Analyst Rating: ${fundamentals.viability.analystRating}\n`;
      context += `- ${fundamentals.viability.summary}\n\n`;
      
      context += `**Risk Factors:**\n`;
      if (fundamentals.risk.debtToEbitda !== null) context += `- Debt/EBITDA: ${fundamentals.risk.debtToEbitda.toFixed(1)}\n`;
      if (fundamentals.risk.currentRatio !== null) context += `- Current Ratio: ${fundamentals.risk.currentRatio.toFixed(2)}\n`;
      if (fundamentals.risk.earningsRisk) context += `- ⚠️ EARNINGS IN ${fundamentals.risk.daysToEarnings} DAYS - HIGH EVENT RISK\n`;
      if (fundamentals.risk.insiderSentiment !== 'neutral') context += `- Insider Sentiment: ${fundamentals.risk.insiderSentiment}\n`;
      context += `- ${fundamentals.risk.summary}\n\n`;
    }

    // Score breakdown for reference
    context += `**Score Breakdown (for reference only - already stated above):**\n`;
    context += `Technical ${score.technical}/100 | Momentum ${score.momentum}/100 | Trend ${score.trend}/100 | Pattern ${score.pattern}/100 | Volume ${score.volume}/100\n\n`;

    // News sentiment (if available)
    if (newsSummary && newsSummary.overallSentiment) {
      context += `**Recent News Sentiment:**\n`;
      context += `- Overall: ${newsSummary.overallSentiment.toUpperCase()} `;
      if (typeof newsSummary.sentimentScore === 'number') {
        context += `(Score: ${newsSummary.sentimentScore.toFixed(0)})\n`;
      } else {
        context += `\n`;
      }
      if (newsSummary.summary) {
        context += `- Summary: ${newsSummary.summary}\n`;
      }
      if (newsSummary.keyThemes && Array.isArray(newsSummary.keyThemes) && newsSummary.keyThemes.length > 0) {
        context += `- Key Themes: ${newsSummary.keyThemes.join(', ')}\n`;
      }
      context += `\n`;
    }

    // REPEAT THE SCORE ONE MORE TIME RIGHT BEFORE INSTRUCTIONS
    context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context += `🎯 REMINDER: Your Executive Summary MUST say "${symbol} Setup Score: ${score.overall}/100 (${score.overall >= 90 ? 'A+' : score.overall >= 76 ? 'A' : score.overall >= 61 ? 'B' : score.overall >= 41 ? 'C' : 'D'} rating)"\n`;
    context += `DO NOT write any other number. The score is ${score.overall}/100, NOT 62/100 or 52/100.\n`;
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Instructions for analysis
    context += `As a professional swing trader with expertise in technical AND fundamental analysis, provide:\n\n`;
    context += `**Market Structure & Setup Quality**\n[2-3 sentences on WHY this setup is tradeable based on technical structure; how fundamentals (relative to industry norms) and sentiment strengthen or weaken conviction]\n\n`;
    context += `**Entry Tactics & Risk Management**\n[Specific guidance on entry timing, stop placement, position sizing - factor in valuation and sentiment]\n\n`;
    context += `**Key Factors to Monitor**\n[Technical levels, squeeze dynamics (TTM state/momentum), earnings date, valuation re-ratings, and industry-specific catalysts]\n\n`;
    context += `**Strengths:** [3-5 bullet points covering technical, fundamental, and sentiment factors]\n**Warnings:** [2-4 bullet points including valuation risks and negative sentiment]\n**Reasoning:** [3-5 factors combining technical, fundamental, and news analysis]`;

    return context;
  }

  /**
   * Parse LLM response into structured format
   */
  private parseAnalysisResponse(
    analysis: string,
    indicators: any,
    squeezeAnalysis: any,
    score: any,
    compositePattern: any
  ): {
    narrative: string;
    mentorNotes: string;
    reasoning: string[];
    warnings: string[];
    strengths: string[];
    ratingAdjustment?: {
      adjustedScore: number;
      adjustedRating: 'A+' | 'A' | 'B' | 'C' | 'D';
      reason: string;
    };
  } {
    // Extract rating adjustment if present
    const ratingAdjustmentMatch = analysis.match(/RATING_ADJUSTMENT:\s*(\d+)\/100\s+(A\+|A|B|C|D)\s+-\s+(.+)/i);
    let ratingAdjustment: { adjustedScore: number; adjustedRating: 'A+' | 'A' | 'B' | 'C' | 'D'; reason: string } | undefined;
    
    if (ratingAdjustmentMatch) {
      const adjustedScore = parseInt(ratingAdjustmentMatch[1], 10);
      const adjustedRating = ratingAdjustmentMatch[2].toUpperCase() as 'A+' | 'A' | 'B' | 'C' | 'D';
      const reason = ratingAdjustmentMatch[3].trim();
      
      // Validate adjustment is within ±15 points
      if (Math.abs(adjustedScore - score.overall) <= 15) {
        ratingAdjustment = { adjustedScore, adjustedRating, reason };
        console.log(`[LLM] Rating adjusted: ${score.overall} → ${adjustedScore} (${score.rating} → ${adjustedRating}): ${reason}`);
      } else {
        console.warn(`[LLM] Rating adjustment rejected: ${adjustedScore} is more than ±15 from original ${score.overall}`);
      }
      
      // Remove the RATING_ADJUSTMENT line from the analysis text
      analysis = analysis.replace(/RATING_ADJUSTMENT:[^\n]+\n?/gi, '');
    }
    
    // Extract sections
    const strengthsMatch = analysis.match(/\*\*Strengths:\*\*\s*([\s\S]*?)(?=\*\*Warnings:|$)/i);
    const warningsMatch = analysis.match(/\*\*Warnings:\*\*\s*([\s\S]*?)(?=\*\*Reasoning:|$)/i);
    const reasoningMatch = analysis.match(/\*\*Reasoning:\*\*\s*([\s\S]*?)$/i);

    const strengths = strengthsMatch 
      ? strengthsMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•')).map(l => l.replace(/^[-•]\s*/, '').trim())
      : [];
    
    const warnings = warningsMatch
      ? warningsMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•')).map(l => l.replace(/^[-•]\s*/, '').trim())
      : [];
    
    const reasoning = reasoningMatch
      ? reasoningMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•')).map(l => l.replace(/^[-•]\s*/, '').trim())
      : [];

    // Remove the bullet sections from the main analysis for mentor notes
    let mentorNotes = analysis
      .replace(/\*\*Strengths:\*\*[\s\S]*$/, '')
      .trim();

    // Generate narrative summary
    const narrative = `${compositePattern.candlestickPattern.name} detected with ${score.rating} rating (${score.overall}/100). ${
      squeezeAnalysis && squeezeAnalysis.combinedPotential === 'extreme' ? '🔥 EXTREME SQUEEZE POTENTIAL DETECTED!' :
      squeezeAnalysis && squeezeAnalysis.combinedPotential === 'high' ? '⚡ High squeeze potential identified.' :
      indicators.trend === 'bullish' ? 'Bullish market structure.' : indicators.trend === 'bearish' ? 'Bearish market structure.' : 'Neutral structure.'
    }`;

    return {
      narrative,
      mentorNotes,
      reasoning: reasoning.length > 0 ? reasoning : [`${compositePattern.candlestickPattern.name}`, `${indicators.trend} trend`, `RSI ${indicators.rsi.toFixed(1)}`],
      warnings: warnings.length > 0 ? warnings : indicators.rsi > 70 ? ['RSI overbought'] : indicators.rsi < 30 ? ['RSI oversold'] : [],
      strengths: strengths.length > 0 ? strengths : score.overall > 70 ? ['High quality setup'] : ['Meets technical criteria'],
      ratingAdjustment,
    };
  }

  /**
   * Fallback analysis if OpenAI fails
   */
  private generateFallbackAnalysis(
    symbol: string,
    timeframe: string,
    indicators: any,
    compositePattern: any,
    score: any,
    squeezeAnalysis?: any
  ): {
    narrative: string;
    mentorNotes: string;
    reasoning: string[];
    warnings: string[];
    strengths: string[];
  } {
    const chartInfo = compositePattern.chartPattern 
      ? `${compositePattern.chartPattern.name} (${compositePattern.chartPattern.confidence}%) provides structure.`
      : 'No chart pattern detected.';
    
    let squeezeNarrative = '';
    if (squeezeAnalysis && squeezeAnalysis.combinedPotential !== 'none') {
      const sq = squeezeAnalysis;
      if (sq.combinedPotential === 'extreme' || sq.combinedPotential === 'high') {
        squeezeNarrative = ` 🔥 ${sq.combinedPotential.toUpperCase()} SQUEEZE: ${sq.recommendation}`;
      }
    }
    
    const narrative = `${symbol} shows ${compositePattern.candlestickPattern.name} on ${timeframe}. ${chartInfo} ${indicators.trend} trend with RSI ${indicators.rsi.toFixed(1)}. Score: ${score.overall}/100.${squeezeNarrative}`;
    
    let mentorNotes = `${compositePattern.analysis} Technical setup with ${score.rating} rating.`;
    if (squeezeAnalysis && squeezeAnalysis.combinedPotential !== 'none') {
      mentorNotes += `\n\n📊 Squeeze Analysis:\n${squeezeAnalysis.recommendation}`;
    }
    
    const reasoning = [`${compositePattern.candlestickPattern.name}`, chartInfo, `${indicators.trend} trend`];
    const warnings: string[] = [];
    if (indicators.rsi > 70) warnings.push('RSI overbought');
    if (indicators.rsi < 30) warnings.push('RSI oversold');
    
    const strengths: string[] = [];
    if (score.overall > 70) strengths.push('High setup quality');
    if (squeezeAnalysis && squeezeAnalysis.combinedPotential === 'extreme') {
      strengths.push('EXTREME squeeze potential');
    }
    
    return { narrative, mentorNotes, reasoning, warnings, strengths };
  }
}
