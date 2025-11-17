/**
 * LLM Analyzer - AI-powered analysis generation using OpenAI GPT-4o-mini
 */

export class LLMAnalyzer {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate composite analysis with OpenAI GPT-4o-mini
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
    optionsInsight?: any
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
        optionsInsight
      );

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert swing trading mentor with expertise in technical analysis and fundamentals. Provide concise, actionable analysis focused on:
1. WHY the setup is tradeable (or not) - analyze market structure, not just criteria
2. SPECIFIC entry tactics and risk management
3. KEY factors traders should watch
4. Squeeze dynamics (short interest + volatility compression)
5. Real-world execution considerations

🚨 RATING ADJUSTMENT AUTHORITY 🚨
You can adjust the technical score by ±15 points (±1 full grade) after analyzing ALL factors:
- Technical score is provided (e.g., "40/100 D rating")
- You may UPGRADE if: strong fundamentals + positive catalysts + favorable sentiment outweigh weak technicals
- You may DOWNGRADE if: fundamental risks + negative catalysts + adverse sentiment override strong technicals
- Grade boundaries: 0-40=D, 41-60=C, 61-75=B, 76-89=A, 90+=A+

To adjust, include this exact line in your response:
RATING_ADJUSTMENT: [new_score]/100 [new_rating] - [one sentence reason]

Example adjustments:
- "RATING_ADJUSTMENT: 55/100 C - Upgraded from D due to excellent fundamentals (Quality 85/100) and positive earnings catalyst"
- "RATING_ADJUSTMENT: 35/100 D - Downgraded from C due to overvaluation and negative earnings surprise"
- If no adjustment needed, omit this line entirely

🚨 SCORE USAGE 🚨
When mentioning the score in your narrative:
- If you adjusted it, use the NEW score everywhere
- If not adjusted, use the ORIGINAL score exactly as provided

🚨 OPTIONS RULES 🚨
If context says "Options data is not available", do NOT mention options, call/put ratios, or smart money.

Be direct and practical. Avoid repeating obvious criteria. Focus on insights a trader can act on.`
            },
            {
              role: 'user',
              content: context
            }
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        console.error('[LLM] OpenAI API error:', response.statusText);
        return this.generateFallbackAnalysis(symbol, timeframe, indicators, compositePattern, score, squeezeAnalysis);
      }

      const data = await response.json();
      const analysis = data.choices[0].message.content;

      // Parse LLM response
      return this.parseAnalysisResponse(analysis, indicators, squeezeAnalysis, score, compositePattern);
      
    } catch (error) {
      console.error('[LLM] Error generating analysis:', error);
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
    optionsInsight?: any
  ): string {
    // START WITH THE SCORE - MOST IMPORTANT
    let context = `**YOU MUST USE THIS EXACT SCORE IN YOUR ANALYSIS:**\n`;
    context += `${symbol} Setup Score: ${score.overall}/100 (${score.overall >= 90 ? 'A+' : score.overall >= 76 ? 'A' : score.overall >= 61 ? 'B' : score.overall >= 41 ? 'C' : 'D'} rating)\n`;
    context += `DO NOT say "40/100" or "52/100" or any other number. The score is ${score.overall}/100.\n\n`;
    
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

    // Options Flow Analysis (if available)
    if (optionsInsight) {
      context += `**Options Flow & Sentiment:**\n`;
      context += `- Sentiment: ${optionsInsight.sentiment.toUpperCase()} (${optionsInsight.confidence} confidence)\n`;
      if (typeof optionsInsight.callPutRatio === 'number' && !isNaN(optionsInsight.callPutRatio)) {
        const cpRatio = optionsInsight.callPutRatio > 999 ? '999+' : optionsInsight.callPutRatio.toFixed(2);
        context += `- Call/Put Ratio: ${cpRatio} (${optionsInsight.totalCallVolume} calls vs ${optionsInsight.totalPutVolume} puts near ATM $${optionsInsight.atmStrike.toFixed(2)})\n`;
      }
      context += `- IV Trend: ${optionsInsight.ivTrend.toUpperCase()} ${optionsInsight.ivTrend === 'rising' ? '(increased uncertainty/event risk)' : optionsInsight.ivTrend === 'falling' ? '(calmer markets)' : ''}\n`;
      if (optionsInsight.topCallStrikes && optionsInsight.topCallStrikes.length > 0) {
        const topCall = optionsInsight.topCallStrikes[0];
        context += `- Top Call Activity: $${topCall.strike.toFixed(2)} strike (${topCall.volume} vol, ${topCall.oi} OI)\n`;
      }
      if (optionsInsight.topPutStrikes && optionsInsight.topPutStrikes.length > 0) {
        const topPut = optionsInsight.topPutStrikes[0];
        context += `- Top Put Activity: $${topPut.strike.toFixed(2)} strike (${topPut.volume} vol, ${topPut.oi} OI)\n`;
      }
      if (optionsInsight.expirations && optionsInsight.expirations.length > 0) {
        context += `- Nearest Expirations: ${optionsInsight.expirations.join(', ')}\n`;
      }
      context += `- **Interpretation:** ${optionsInsight.message}\n`;
      context += `\n`;
    }

    // REPEAT THE SCORE ONE MORE TIME RIGHT BEFORE INSTRUCTIONS
    context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context += `🎯 REMINDER: Your Executive Summary MUST say "${symbol} Setup Score: ${score.overall}/100 (${score.overall >= 90 ? 'A+' : score.overall >= 76 ? 'A' : score.overall >= 61 ? 'B' : score.overall >= 41 ? 'C' : 'D'} rating)"\n`;
    context += `DO NOT write any other number. The score is ${score.overall}/100, NOT 62/100 or 52/100.\n`;
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Adjust instructions based on available data
    const hasOptions = optionsInsight && optionsInsight.sentiment;
    
    if (hasOptions) {
      context += `As a professional swing trader with expertise in technical AND fundamental analysis AND options flow, provide:\n\n`;
      context += `**Market Structure & Setup Quality**\n[2-3 sentences on WHY this setup is tradeable based on technical structure; how fundamentals (relative to industry norms), sentiment, and options flow strengthen or weaken conviction]\n\n`;
      context += `**Entry Tactics & Risk Management**\n[Specific guidance on entry timing, stop placement, position sizing - factor in valuation, sentiment, and what options traders are positioning for]\n\n`;
      context += `**Key Factors to Monitor**\n[Technical levels, squeeze dynamics (TTM state/momentum), earnings date, valuation re-ratings, options positioning shifts (call/put activity), and industry-specific catalysts]\n\n`;
      context += `**Strengths:** [3-5 bullet points covering technical, fundamental, sentiment, and options factors]\n**Warnings:** [2-4 bullet points including valuation risks, negative sentiment, and bearish options positioning]\n**Reasoning:** [3-5 factors combining technical, fundamental, news, and options flow analysis - explain what the options activity suggests about near-term price direction]`;
    } else {
      context += `As a professional swing trader with expertise in technical AND fundamental analysis, provide:\n\n`;
      context += `**Market Structure & Setup Quality**\n[2-3 sentences on WHY this setup is tradeable based on technical structure; how fundamentals (relative to industry norms) and sentiment strengthen or weaken conviction]\n\n`;
      context += `**Entry Tactics & Risk Management**\n[Specific guidance on entry timing, stop placement, position sizing - factor in valuation and sentiment]\n\n`;
      context += `**Key Factors to Monitor**\n[Technical levels, squeeze dynamics (TTM state/momentum), earnings date, valuation re-ratings, and industry-specific catalysts]\n\n`;
      context += `**Strengths:** [3-5 bullet points covering technical, fundamental, and sentiment factors]\n**Warnings:** [2-4 bullet points including valuation risks and negative sentiment]\n**Reasoning:** [3-5 factors combining technical, fundamental, and news analysis]\n\n`;
      context += `NOTE: Options data is not available for this ticker. Do NOT mention options positioning, call/put activity, or smart money options flow in your analysis.`;
    }

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

  /**
   * Generate strategy-specific analysis with deep squeeze insights
   * Provides FOR/AGAINST trade case + practical execution guidance
   */
  async generateStrategyAnalysis(
    symbol: string,
    evaluation: any,
    strategyInput: any,
    squeezeAnalysis?: any
  ): Promise<{
    mentorNotes: string;
    forTrade: string[];
    againstTrade: string[];
  }> {
    try {
      // Build comprehensive context
      const context = this.buildStrategyAnalysisContext(
        symbol,
        evaluation,
        strategyInput,
        squeezeAnalysis
      );

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert swing trading mentor providing UNIFIED, SCORE-DRIVEN analysis. Your job is to synthesize ALL data into actionable guidance.

**CRITICAL: You will receive a COMBINED SQUEEZE SCORE (0-100) that fuses:**
- Short Float pressure (days to cover, % of float, short volume)
- TTM Squeeze state (ON/FIRE/OFF, duration, momentum)
- Alignment bonus (when both work together)

**Your analysis MUST dynamically adjust based on the squeeze score:**

**Score 80-100 (EXTREME):**
  • Conviction: VERY HIGH - both squeezes firing with alignment
  • Action: IMMEDIATE entry on breakout candle
  • Position sizing: AGGRESSIVE (1.5-2% risk)
  • Tone: Urgent, confident - "This is the setup traders wait months for"

**Score 60-79 (HIGH):**
  • Conviction: HIGH - strong squeeze present
  • Action: Enter on breakout confirmation OR wait for FIRE if TTM ON
  • Position sizing: STANDARD (1% risk)
  • Tone: Confident but measured - "Solid setup with clear catalyst"

**Score 40-59 (MODERATE):**
  • Conviction: MODERATE - setup building
  • Action: WAIT for squeeze FIRE before entry
  • Position sizing: CONSERVATIVE (0.5% risk)
  • Tone: Cautious optimism - "Setup forming, monitor closely"

**Score 15-39 (LOW):**
  • Conviction: LOW - minimal squeeze pressure
  • Action: MONITOR only, use standard strategy rules
  • Position sizing: MINIMAL (0.25% risk or skip)
  • Tone: Neutral - "Squeeze not a primary factor here"

**Score 0-14 (NONE):**
  • Conviction: MINIMAL - no squeeze dynamics
  • Action: Standard strategy analysis only
  • Tone: Factual - "No squeeze component to this trade"

**YOU MUST:**
1. **Explicitly link** short float % + TTM state → combined effect (e.g., "14% short float + 13-bar TTM ON = moderate fuel for breakout")
2. **Explain the score** - why it's 34/100 vs 75/100 and what that means for probability
3. **Adjust your recommendation strength** based on score (don't sound equally excited about 30/100 vs 85/100!)
4. **Translate score to probability** - "With 75/100 squeeze score + bullish trend, probability of 10%+ move = 60-70%"
5. **Provide score-specific tactics** - entry timing, stop placement, position size ALL change with squeeze score

Be direct, analytical, and DYNAMICALLY RESPONSIVE to the unified squeeze score. This score is your PRIMARY conviction driver.`
            },
            {
              role: 'user',
              content: context
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        console.error('[LLM] OpenAI API error:', response.statusText);
        return this.generateFallbackStrategyAnalysis(evaluation, squeezeAnalysis);
      }

      const data = await response.json();
      const analysis = data.choices[0].message.content;

      // Parse response
      return this.parseStrategyAnalysisResponse(analysis, evaluation, squeezeAnalysis);
      
    } catch (error) {
      console.error('[LLM] Error generating strategy analysis:', error);
      return this.generateFallbackStrategyAnalysis(evaluation, squeezeAnalysis);
    }
  }

  /**
   * Build strategy analysis context with deep squeeze details
   */
  private buildStrategyAnalysisContext(
    symbol: string,
    evaluation: any,
    strategyInput: any,
    squeezeAnalysis?: any
  ): string {
    // ========================================
    // START WITH MANDATORY SQUEEZE SCORE
    // ========================================
    const squeezeScore = squeezeAnalysis?.combinedScore || 0;
    const squeezePotential = squeezeAnalysis?.combinedPotential || 'none';
    const squeezeConviction = squeezeAnalysis?.conviction || 'minimal';
    
    let context = `🚨 **MANDATORY: READ THIS FIRST** 🚨\n\n`;
    context += `**COMBINED SQUEEZE SCORE: ${squeezeScore}/100** (${squeezePotential.toUpperCase()} potential)\n`;
    context += `**CONVICTION LEVEL: ${squeezeConviction.toUpperCase()}**\n`;
    context += `**YOU MUST reference this ${squeezeScore}/100 score in your analysis!**\n`;
    context += `**Your tone and recommendations MUST match the ${squeezePotential} potential level!**\n\n`;
    context += `---\n\n`;
    context += `Now analyze ${symbol} strategy setup:\n\n`;
    
    // ========================================
    // DETAILED SQUEEZE BREAKDOWN
    // ========================================
    if (squeezeAnalysis && squeezeAnalysis.combinedPotential && squeezeAnalysis.combinedPotential !== 'none') {
      const sq = squeezeAnalysis;
      const breakdown = sq.scoreBreakdown || {};
      
      context += `**🔥 UNIFIED SQUEEZE ANALYSIS (Critical for Trade Decision)**:\n\n`;
      
      // Combined score with conviction and action timing
      context += `**Combined Squeeze Score: ${sq.combinedScore || 0}/100** (${(sq.combinedPotential || 'NONE').toUpperCase()} potential)\n`;
      context += `**Conviction Level**: ${sq.conviction?.toUpperCase() || 'N/A'}\n`;
      context += `**Action Timing**: ${sq.actionTiming === 'immediate' ? '⚡ IMMEDIATE - Enter on breakout' :
                                      sq.actionTiming === 'wait-for-fire' ? '⏳ WAIT FOR FIRE - Setup building' :
                                      sq.actionTiming === 'monitor' ? '👀 MONITOR - Not ready yet' :
                                      '❌ NOT RECOMMENDED - Insufficient setup'}\n`;
      context += `**Position Sizing**: ${sq.positionSizingGuidance === 'aggressive' ? '🔥 AGGRESSIVE (1.5-2% risk)' :
                                        sq.positionSizingGuidance === 'standard' ? '✅ STANDARD (1% risk)' :
                                        sq.positionSizingGuidance === 'conservative' ? '⚠️ CONSERVATIVE (0.5% risk)' :
                                        '🚫 MINIMAL (0.25% or skip)'}\n`;
      
      if (sq.alignment) {
        context += `\n⚡⚡⚡ **BOTH SQUEEZES ALIGNED** - Short interest + volatility compression working together! ⚡⚡⚡\n`;
      }
      context += `\n`;
      
      // DETAILED SCORING BREAKDOWN (with safe defaults)
      context += `**📊 Scoring Breakdown (How We Got ${sq.combinedScore || 0}/100)**:\n`;
      context += `\n**Short Float Component** (${(breakdown.shortWeight || 0.5) * 100}% weight = ${((breakdown.totalShortScore || 0) * (breakdown.shortWeight || 0.5)).toFixed(0)} points):\n`;
      context += `  • Short Float ${sq.shortSqueeze?.shortFloat?.toFixed(1) || 'N/A'}%: ${breakdown.shortFloatPoints || 0} points\n`;
      context += `  • Days to Cover ${sq.shortSqueeze?.daysToCover?.toFixed(1) || 'N/A'}: ${breakdown.daysToCoverPoints || 0} points\n`;
      context += `  • Short Volume pressure: ${breakdown.shortVolumePoints || 0} points\n`;
      context += `  • Total Short Score: ${breakdown.totalShortScore || 0}/100\n`;
      context += `\n**TTM Squeeze Component** (${(breakdown.ttmWeight || 0.5) * 100}% weight = ${((breakdown.totalTTMScore || 0) * (breakdown.ttmWeight || 0.5)).toFixed(0)} points):\n`;
      context += `  • State (${sq.ttmSqueeze?.current?.state || 'N/A'}): ${breakdown.ttmStatePoints || 0} points\n`;
      context += `  • Duration (${sq.ttmSqueeze?.squeezeDuration || 0} bars): +${breakdown.ttmDurationBonus || 0} bonus\n`;
      context += `  • Momentum (${sq.ttmSqueeze?.momentumDirection || 'N/A'}, ${sq.ttmSqueeze?.momentumStrength?.toFixed(0) || '0'}%): +${breakdown.momentumBonus || 0} bonus\n`;
      context += `  • Total TTM Score: ${breakdown.totalTTMScore || 0}/100\n`;
      context += `\n**Synergy Bonus**: ${(breakdown.alignmentBonus || 0) > 0 ? `+${breakdown.alignmentBonus} points (both squeezes aligned!)` : '0 (not aligned)'}\n`;
      context += `\n**FINAL COMPOSITE: ${breakdown.totalShortScore || 0} × ${breakdown.shortWeight || 0.5} + ${breakdown.totalTTMScore || 0} × ${breakdown.ttmWeight || 0.5} + ${breakdown.alignmentBonus || 0} = ${sq.combinedScore || 0}/100**\n`;
      context += `\n`;

      // Short Float Squeeze - Deep Analysis
      if (sq.shortSqueeze && sq.shortSqueeze.potential !== 'none') {
        context += `**Short Float Squeeze Analysis**:\n`;
        context += `- Potential: ${sq.shortSqueeze.potential?.toUpperCase() || 'NONE'} (Score: ${sq.shortSqueeze.score || 0}/100)\n`;
        
        if (sq.shortSqueeze.daysToCover !== null && sq.shortSqueeze.daysToCover !== undefined) {
          context += `- Days to Cover: ${sq.shortSqueeze.daysToCover.toFixed(1)} days\n`;
          if (sq.shortSqueeze.daysToCover > 7) {
            context += `  ➜ **VERY HIGH** - Shorts trapped, covering could create explosive move\n`;
          } else if (sq.shortSqueeze.daysToCover > 4) {
            context += `  ➜ **ELEVATED** - Meaningful short interest, covering adds fuel\n`;
          } else {
            context += `  ➜ **MODEST** - Limited short squeeze catalyst\n`;
          }
        }
        
        if (sq.shortSqueeze.shortFloat !== null && sq.shortSqueeze.shortFloat !== undefined) {
          context += `- Short Float: ${sq.shortSqueeze.shortFloat.toFixed(1)}% of float\n`;
          if (sq.shortSqueeze.shortFloat > 20) {
            context += `  ➜ **EXTREME** - Heavily shorted, prime for squeeze\n`;
          } else if (sq.shortSqueeze.shortFloat > 10) {
            context += `  ➜ **SIGNIFICANT** - Notable short interest\n`;
          } else {
            context += `  ➜ **LIGHT** - Limited short pressure\n`;
          }
        }
        
        if (sq.shortSqueeze.shortVolumeZ !== null && sq.shortSqueeze.shortVolumeZ !== undefined) {
          context += `- Short Volume Z-Score: ${sq.shortSqueeze.shortVolumeZ.toFixed(2)}\n`;
          context += `  ➜ Trend: ${sq.shortSqueeze.shortVolumeTrend || 'unknown'}\n`;
        }
        
        context += `\n**Short Squeeze Implications**:\n`;
        if (sq.shortSqueeze.triggers && sq.shortSqueeze.triggers.length > 0) {
          sq.shortSqueeze.triggers.forEach((t: string) => context += `• ${t}\n`);
        }
        context += `\n`;
      }

      // TTM Squeeze - Deep Analysis
      if (sq.ttmSqueeze && sq.ttmSqueeze.current && sq.ttmSqueeze.current.state !== 'OFF') {
        context += `**TTM Squeeze Analysis (Volatility Compression)**:\n`;
        context += `- State: ${sq.ttmSqueeze.current.state}\n`;
        
        if (sq.ttmSqueeze.current.state === 'FIRE') {
          context += `  ➜ 🔥 **JUST FIRED** - Volatility expanding NOW after ${sq.ttmSqueeze.squeezeDuration || 0} bars of compression\n`;
          context += `  ➜ This is the breakout moment traders wait for!\n`;
        } else if (sq.ttmSqueeze.current.state === 'ON') {
          context += `  ➜ ⚡ **BUILDING PRESSURE** - ${sq.ttmSqueeze.squeezeDuration || 0} consecutive bars of compression\n`;
          if ((sq.ttmSqueeze.squeezeDuration || 0) >= 10) {
            context += `  ➜ Extended squeeze (${sq.ttmSqueeze.squeezeDuration} bars) = bigger potential move when it fires\n`;
          } else if ((sq.ttmSqueeze.squeezeDuration || 0) >= 5) {
            context += `  ➜ Solid compression duration - setup ripening\n`;
          }
        }
        
        context += `- Momentum: ${sq.ttmSqueeze.momentumDirection || 'neutral'} (Strength: ${sq.ttmSqueeze.momentumStrength?.toFixed(0) || '0'}%)\n`;
        context += `- MACD Histogram: ${sq.ttmSqueeze.histogram?.toFixed(3) || '0.000'}\n`;
        
        if (sq.ttmSqueeze.fireConfirmed) {
          context += `- ✅ **FIRE CONFIRMED** with ${sq.ttmSqueeze.potentialBreakout || 'neutral'} momentum\n`;
          context += `  ➜ Breakout has directional confirmation - high probability setup\n`;
        } else if (sq.ttmSqueeze.potentialBreakout && sq.ttmSqueeze.potentialBreakout !== 'neutral') {
          context += `- Potential Breakout Direction: ${sq.ttmSqueeze.potentialBreakout}\n`;
        }
        
        context += `\n**TTM Squeeze Implications**:\n`;
        if (sq.ttmSqueeze.triggers && sq.ttmSqueeze.triggers.length > 0) {
          sq.ttmSqueeze.triggers.forEach((t: string) => context += `• ${t}\n`);
        }
        context += `\n`;
      }

      // Combined squeeze interpretation
      context += `**Combined Squeeze Strategy**:\n`;
      context += `${sq.recommendation}\n\n`;
      
      // Risk factors from squeeze
      if (sq.warnings && sq.warnings.length > 0) {
        context += `**Squeeze-Related Risks**:\n`;
        sq.warnings.forEach((w: string) => context += `⚠️ ${w}\n`);
        context += `\n`;
      }
    } else {
      context += `**Squeeze Analysis**: No significant squeeze dynamics detected (Score: 0/100)\n\n`;
    }

    // ========================================
    // STRATEGY & MARKET CONTEXT
    // ========================================
    
    // Strategy details
    const strategyName = evaluation.metadata?.strategyName || evaluation.strategy;
    context += `**Strategy**: ${strategyName}\n`;
    context += `**Direction**: ${evaluation.plan?.direction.toUpperCase() || 'N/A'}\n`;
    context += `**Status**: ${evaluation.status}\n`;
    context += `**Quality**: ${(evaluation.quality * 100).toFixed(0)}%\n`;
    context += `**Viability**: ${(evaluation.viability * 100).toFixed(0)}%\n`;
    context += `**R:R (First)**: ${evaluation.rrFirst.toFixed(2)}:1\n\n`;

    // Trade plan
    if (evaluation.plan) {
      context += `**Trade Plan**:\n`;
      context += `- Entry: $${evaluation.plan.entry.toFixed(2)}\n`;
      context += `- Stop: $${evaluation.plan.stop.toFixed(2)} (${((evaluation.plan.stop - evaluation.plan.entry) / evaluation.plan.entry * 100).toFixed(2)}%)\n`;
      context += `- Targets:\n`;
      evaluation.plan.targets.forEach((t: any, i: number) => {
        const rr = Math.abs((t.level - evaluation.plan.entry) / (evaluation.plan.stop - evaluation.plan.entry));
        context += `  • ${t.label || `T${i+1}`}: $${t.level.toFixed(2)} (${rr.toFixed(2)}R)\n`;
      });
      context += `\n`;
    }

    // Market structure
    context += `**Market Structure**:\n`;
    context += `- Current Price: $${strategyInput.price.toFixed(2)}\n`;
    context += `- Trend: ${strategyInput.ema20 > strategyInput.ema50 && strategyInput.ema50 > strategyInput.ema200 ? 'Bullish (EMA20>50>200)' : 
                       strategyInput.ema20 < strategyInput.ema50 && strategyInput.ema50 < strategyInput.ema200 ? 'Bearish (EMA20<50<200)' : 'Mixed'}\n`;
    context += `- EMAs: 20(${strategyInput.ema20.toFixed(2)}), 50(${strategyInput.ema50.toFixed(2)}), 200(${strategyInput.ema200.toFixed(2)})\n`;
    context += `- RSI: ${strategyInput.rsi14.toFixed(1)}\n`;
    context += `- ATR: ${strategyInput.atr.toFixed(2)} (${strategyInput.atrPct.toFixed(2)}%)\n`;
    context += `- Volume Z: ${strategyInput.volZ.toFixed(2)}\n\n`;

    // Strategy eligibility reasons
    if (evaluation.reasons && evaluation.reasons.length > 0) {
      context += `**Strategy Criteria Met**:\n`;
      evaluation.reasons.forEach((r: string) => context += `• ${r}\n`);
      context += `\n`;
    }

    // Historical context
    if (evaluation.historicalRecent) {
      context += `**Historical Context**:\n`;
      context += `- Sample Size: ${evaluation.historicalRecent.totalSignals} signals\n`;
      if (evaluation.historicalRecent.hasMinSamples) {
        context += `- Win Rate: ${(evaluation.historicalRecent.winRate * 100).toFixed(0)}%\n`;
      } else {
        context += `- ⚠️ Insufficient sample size for statistics\n`;
      }
      context += `\n`;
    }

    context += `**🚨 MANDATORY OUTPUT FORMAT (YOU MUST FOLLOW THIS):**\n\n`;
    context += `**Market Structure & Why This Works**\n`;
    context += `[START by stating: "With a ${squeezeScore}/100 squeeze score (${squeezePotential} potential)..." then explain setup quality]\n\n`;
    context += `**Squeeze Dynamics Impact**\n`;
    context += `[Deep analysis: "The ${squeezeScore}/100 score comes from [short float X% + TTM state + duration]. This means..." Be practical and specific about how THIS SCORE affects probability and execution]\n\n`;
    context += `**Entry & Execution Strategy**\n`;
    context += `[Based on ${squeezePotential} potential and ${squeezeConviction} conviction: entry timing, stop placement, position sizing. ${squeezeScore >= 70 ? 'AGGRESSIVE 1.5-2% risk' : squeezeScore >= 40 ? 'CONSERVATIVE 0.5% risk' : 'MINIMAL 0.25% risk'}]\n\n`;
    context += `**Key Monitoring Points**\n`;
    context += `[What to watch: levels, catalysts, squeeze state changes (currently ${squeezePotential}), volume patterns]\n\n`;
    context += `**FOR THE TRADE:** [4-6 bullet points - specific strengths including squeeze score if >= 40]\n`;
    context += `**AGAINST THE TRADE:** [3-5 bullet points - real risks including low squeeze score if < 40]`;

    return context;
  }

  /**
   * Parse strategy analysis response
   */
  private parseStrategyAnalysisResponse(
    analysis: string,
    evaluation: any,
    squeezeAnalysis: any
  ): {
    mentorNotes: string;
    forTrade: string[];
    againstTrade: string[];
  } {
    // Extract FOR/AGAINST sections
    const forMatch = analysis.match(/\*\*FOR THE TRADE:\*\*\s*([\s\S]*?)(?=\*\*AGAINST THE TRADE:|$)/i);
    const againstMatch = analysis.match(/\*\*AGAINST THE TRADE:\*\*\s*([\s\S]*?)$/i);

    const forTrade = forMatch 
      ? forMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•')).map(l => l.replace(/^[-•]\s*/, '').trim())
      : [];
    
    const againstTrade = againstMatch
      ? againstMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•')).map(l => l.replace(/^[-•]\s*/, '').trim())
      : [];

    // Remove FOR/AGAINST from mentor notes
    let mentorNotes = analysis
      .replace(/\*\*FOR THE TRADE:\*\*[\s\S]*$/, '')
      .trim();

    return {
      mentorNotes,
      forTrade: forTrade.length > 0 ? forTrade : ['Meets strategy criteria', 'Technical setup present'],
      againstTrade: againstTrade.length > 0 ? againstTrade : ['Limited historical data', 'Market conditions may change'],
    };
  }

  /**
   * Fallback strategy analysis if OpenAI fails
   */
  private generateFallbackStrategyAnalysis(
    evaluation: any,
    squeezeAnalysis?: any
  ): {
    mentorNotes: string;
    forTrade: string[];
    againstTrade: string[];
  } {
    let mentorNotes = `**Market Structure & Setup**\n\nThis ${evaluation.strategy} setup meets the defined criteria with ${(evaluation.quality * 100).toFixed(0)}% quality score.`;
    
    const forTrade: string[] = [];
    const againstTrade: string[] = [];

    // Build FOR section
    if (evaluation.quality > 0.7) forTrade.push('High quality setup (>70%)');
    if (evaluation.viability > 0.8) forTrade.push('Strong viability score');
    if (evaluation.rrFirst >= 2) forTrade.push(`Favorable R:R ratio (${evaluation.rrFirst.toFixed(2)}:1)`);
    
    if (squeezeAnalysis && squeezeAnalysis.combined.potential !== 'none') {
      mentorNotes += `\n\n**Squeeze Dynamics**\n\n${squeezeAnalysis.combined.recommendation}`;
      
      if (squeezeAnalysis.combined.potential === 'extreme' || squeezeAnalysis.combined.potential === 'high') {
        forTrade.push(`${squeezeAnalysis.combined.potential.toUpperCase()} squeeze potential detected`);
      }
      if (squeezeAnalysis.combined.alignment) {
        forTrade.push('Both short squeeze and TTM squeeze aligned');
      }
      if (squeezeAnalysis.ttmSqueeze.state === 'FIRE') {
        forTrade.push('TTM Squeeze just FIRED - breakout in progress');
      }
    }

    // Build AGAINST section
    if (evaluation.rrFirst < 2) againstTrade.push('Modest R:R ratio');
    if (!evaluation.historicalRecent?.hasMinSamples) againstTrade.push('Limited historical sample size');
    if (evaluation.quality < 0.7) againstTrade.push('Below-average setup quality');
    
    if (squeezeAnalysis && squeezeAnalysis.combined.warnings.length > 0) {
      againstTrade.push(...squeezeAnalysis.combined.warnings.slice(0, 2));
    }

    mentorNotes += `\n\n**Execution Guidance**\n\nFollow the defined entry, stop, and target levels. Monitor price action for confirmation before entry.`;
    
    return {
      mentorNotes,
      forTrade: forTrade.length > 0 ? forTrade : ['Meets strategy criteria'],
      againstTrade: againstTrade.length > 0 ? againstTrade : ['Standard market risks apply'],
    };
  }
}

