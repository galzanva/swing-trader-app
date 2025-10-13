/**
 * OpenAI LLM Analyzer
 * Generates expert analysis and mentor insights
 */

import OpenAI from "openai";
import { TechnicalIndicators } from "../indicators/technical";
import { DetectedPattern, CompositePattern } from "../patterns/detector";
import { SetupScore } from "../scoring/rating";
import { RiskManagementPlan } from "../risk/management";

export interface AIAnalysis {
  narrative: string;
  mentorNotes: string;
  reasoning: string[];
  warnings: string[];
  strengths: string[];
}

export class LLMAnalyzer {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate comprehensive AI analysis
   */
  async generateAnalysis(
    symbol: string,
    timeframe: string,
    indicators: TechnicalIndicators,
    pattern: DetectedPattern,
    score: SetupScore,
    risk: RiskManagementPlan
  ): Promise<AIAnalysis> {
    const prompt = this.buildAnalysisPrompt(symbol, timeframe, indicators, pattern, score, risk);

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert swing trading analyst with 20+ years of experience in technical analysis, chart patterns, and risk management. Your role is to provide clear, factual analysis based ONLY on the technical data provided. Do not speculate or make predictions. Focus on what the data shows RIGHT NOW.

Rules:
- Use ONLY the provided technical data
- Be factual and objective
- Explain what indicators mean for swing traders
- Highlight both opportunities AND risks
- Use clear, professional language
- No hype or promotional language
- Focus on education and transparency`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more factual output
        max_tokens: 1500
      });

      const response = completion.choices[0].message.content || "";
      
      return this.parseAIResponse(response, indicators, pattern, score);
    } catch (error) {
      console.error("Error generating AI analysis:", error);
      
      // Fallback to rule-based analysis if API fails
      return this.generateFallbackAnalysis(symbol, indicators, pattern, score, risk);
    }
  }

  /**
   * Build the analysis prompt
   */
  private buildAnalysisPrompt(
    symbol: string,
    timeframe: string,
    indicators: TechnicalIndicators,
    pattern: DetectedPattern,
    score: SetupScore,
    risk: RiskManagementPlan
  ): string {
    return `Analyze this swing trading setup for ${symbol} on ${timeframe} timeframe:

TECHNICAL INDICATORS:
- EMA9: ${indicators.ema9.toFixed(2)}
- EMA20: ${indicators.ema20.toFixed(2)}
- EMA50: ${indicators.ema50.toFixed(2)}
- EMA200: ${indicators.ema200.toFixed(2)}
- RSI: ${indicators.rsi.toFixed(1)}
- MACD: ${indicators.macd.value.toFixed(2)} (Signal: ${indicators.macd.signal.toFixed(2)}, Histogram: ${indicators.macd.histogram.toFixed(2)})
- Volume Z-Score: ${indicators.volumeZScore.toFixed(2)}
- ATR: ${indicators.atr.toFixed(2)}
- Trend: ${indicators.trend} (Strength: ${indicators.strength})

PATTERN DETECTED:
- ${pattern.name} (${pattern.type}, ${pattern.confidence}% confidence)
- ${pattern.description}

SETUP SCORE:
- Overall: ${score.overall}/100 (${score.rating})
- Technical: ${score.technical}/100
- Momentum: ${score.momentum}/100
- Trend: ${score.trend}/100
- Pattern: ${score.pattern}/100
- Volume: ${score.volume}/100

RISK MANAGEMENT:
- Entry: $${risk.entry}
- Stop Loss: $${risk.stopLoss}
- Target 1: $${risk.targets.target1} (${risk.riskReward.target1}:1 R:R)
- Target 2: $${risk.targets.target2} (${risk.riskReward.target2}:1 R:R)
- Target 3: $${risk.targets.target3} (${risk.riskReward.target3}:1 R:R)

Provide THREE sections:

1. NARRATIVE (3-4 sentences): Explain what the technical data shows about this setup right now. Be factual and objective.

2. MENTOR NOTES (4-5 points): Explain what each key indicator means and why it matters for swing traders. Educate the trader.

3. KEY FACTORS:
   - List 2-3 STRENGTHS this setup has
   - List 2-3 WARNINGS or risks to be aware of
   - List 2-3 RULES that fired (what technical criteria support this setup)

Be concise, clear, and educational. Stick to the facts.`;
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(
    response: string,
    indicators: TechnicalIndicators,
    pattern: DetectedPattern,
    score: SetupScore
  ): AIAnalysis {
    // Extract sections from response
    const narrativeMatch = response.match(/NARRATIVE[:\s]+([\s\S]*?)(?=MENTOR|$)/i);
    const mentorMatch = response.match(/MENTOR\s+NOTES[:\s]+([\s\S]*?)(?=KEY\s+FACTORS|STRENGTHS|WARNINGS|$)/i);
    const strengthsMatch = response.match(/STRENGTHS[:\s]+([\s\S]*?)(?=WARNINGS|RULES|$)/i);
    const warningsMatch = response.match(/WARNINGS[:\s]+([\s\S]*?)(?=RULES|STRENGTHS|$)/i);
    const rulesMatch = response.match(/RULES[:\s]+([\s\S]*?)$/i);

    const narrative = narrativeMatch ? narrativeMatch[1].trim() : this.getDefaultNarrative(indicators, pattern, score);
    const mentorNotes = mentorMatch ? mentorMatch[1].trim() : this.getDefaultMentorNotes(indicators);
    
    const strengths = strengthsMatch 
      ? this.extractBulletPoints(strengthsMatch[1]) 
      : this.getDefaultStrengths(indicators, pattern, score);
    
    const warnings = warningsMatch 
      ? this.extractBulletPoints(warningsMatch[1]) 
      : this.getDefaultWarnings(indicators, pattern, score);
    
    const reasoning = rulesMatch 
      ? this.extractBulletPoints(rulesMatch[1]) 
      : this.getDefaultReasoning(indicators, pattern);

    return {
      narrative,
      mentorNotes,
      reasoning,
      warnings,
      strengths
    };
  }

  /**
   * Extract bullet points from text and clean markdown formatting
   */
  private extractBulletPoints(text: string): string[] {
    return text
      .split('\n')
      .map(line => {
        // Remove bullet markers
        let cleaned = line.replace(/^[-*•]\s*/, '').trim();
        // Remove bold markdown (**text** or __text__)
        cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
        cleaned = cleaned.replace(/__(.+?)__/g, '$1');
        // Remove italic markdown (*text* or _text_)
        cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
        cleaned = cleaned.replace(/_(.+?)_/g, '$1');
        // Remove any "THAT FIRED" remnants
        cleaned = cleaned.replace(/THAT\s+FIRED[:\s]*$/i, '').trim();
        return cleaned;
      })
      .filter(line => line.length > 0 && !line.match(/^(NARRATIVE|MENTOR|KEY|STRENGTHS|WARNINGS|RULES|THAT\s+FIRED)/i))
      .slice(0, 5);
  }

  /**
   * Generate fallback analysis if API fails
   */
  private generateFallbackAnalysis(
    symbol: string,
    indicators: TechnicalIndicators,
    pattern: DetectedPattern,
    score: SetupScore,
    risk: RiskManagementPlan
  ): AIAnalysis {
    return {
      narrative: this.getDefaultNarrative(indicators, pattern, score),
      mentorNotes: this.getDefaultMentorNotes(indicators),
      reasoning: this.getDefaultReasoning(indicators, pattern),
      warnings: this.getDefaultWarnings(indicators, pattern, score),
      strengths: this.getDefaultStrengths(indicators, pattern, score)
    };
  }

  private getDefaultNarrative(indicators: TechnicalIndicators, pattern: DetectedPattern, score: SetupScore): string {
    return `Technical analysis reveals a ${pattern.type} setup with ${pattern.name} pattern showing ${pattern.confidence}% confidence. The ${indicators.trend} trend is supported by EMA alignment with ${indicators.strength} strength. RSI at ${indicators.rsi.toFixed(1)} indicates ${indicators.rsi > 70 ? 'overbought' : indicators.rsi < 30 ? 'oversold' : 'neutral'} conditions. Overall setup scores ${score.overall}/100 (${score.rating}) with ${score.recommendation} recommendation.`;
  }

  private getDefaultMentorNotes(indicators: TechnicalIndicators): string {
    const notes: string[] = [];
    
    notes.push(`• RSI (${indicators.rsi.toFixed(1)}): Measures momentum. 30-70 is normal, below 30 is oversold, above 70 is overbought.`);
    notes.push(`• MACD (${indicators.macd.histogram > 0 ? 'Positive' : 'Negative'}): Trend-following indicator. Positive histogram suggests bullish momentum.`);
    notes.push(`• EMAs: Moving averages smooth price action. Price above EMAs suggests uptrend, below suggests downtrend.`);
    notes.push(`• Volume Z-Score (${indicators.volumeZScore.toFixed(2)}): Measures volume relative to average. Above 1 is high interest.`);
    notes.push(`• ATR (${indicators.atr.toFixed(2)}): Average True Range shows volatility. Used for stop-loss placement.`);
    
    return notes.join('\n');
  }

  private getDefaultReasoning(indicators: TechnicalIndicators, pattern: DetectedPattern): string[] {
    const rules: string[] = [];
    
    rules.push(`${pattern.name} pattern identified with ${pattern.confidence}% confidence`);
    
    if (indicators.trend === "bullish") {
      rules.push("Bullish EMA alignment detected (9>20>50>200)");
    } else if (indicators.trend === "bearish") {
      rules.push("Bearish EMA alignment detected (9<20<50<200)");
    }
    
    if (indicators.macd.histogram > 0) {
      rules.push("MACD histogram positive - bullish momentum");
    } else {
      rules.push("MACD histogram negative - bearish momentum");
    }
    
    if (indicators.volumeZScore > 1) {
      rules.push("Above-average volume confirms move");
    }
    
    return rules;
  }

  private getDefaultWarnings(indicators: TechnicalIndicators, pattern: DetectedPattern, score: SetupScore): string[] {
    const warnings: string[] = [];
    
    if (indicators.rsi > 70) {
      warnings.push("RSI overbought - potential pullback risk");
    } else if (indicators.rsi < 30) {
      warnings.push("RSI oversold - downtrend may continue");
    }
    
    if (indicators.volumeZScore < 0) {
      warnings.push("Below-average volume - weaker confirmation");
    }
    
    if (score.overall < 60) {
      warnings.push("Lower confidence setup - consider smaller position size");
    }
    
    if (pattern.confidence < 70) {
      warnings.push("Pattern confidence moderate - wait for stronger confirmation");
    }
    
    return warnings.slice(0, 3);
  }

  private getDefaultStrengths(indicators: TechnicalIndicators, pattern: DetectedPattern, score: SetupScore): string[] {
    const strengths: string[] = [];
    
    if (indicators.trend !== "neutral") {
      strengths.push(`Clear ${indicators.trend} trend alignment`);
    }
    
    if (pattern.confidence > 75) {
      strengths.push("High-confidence pattern formation");
    }
    
    if (indicators.volumeZScore > 1) {
      strengths.push("Strong volume confirmation");
    }
    
    if (score.momentum > 70) {
      strengths.push("Positive momentum indicators");
    }
    
    if (score.overall > 75) {
      strengths.push("High overall setup quality");
    }
    
    return strengths.slice(0, 3);
  }

  /**
   * Generate analysis with chart pattern context
   * This version integrates market structure (chart patterns) with timing (candlestick)
   */
  async generateCompositeAnalysis(
    symbol: string,
    timeframe: string,
    indicators: TechnicalIndicators,
    compositePattern: CompositePattern,
    score: SetupScore,
    risk: RiskManagementPlan
  ): Promise<AIAnalysis> {
    const prompt = this.buildCompositePrompt(symbol, timeframe, indicators, compositePattern, score, risk);

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert swing trading analyst with deep expertise in both chart patterns (market structure) and candlestick patterns (timing signals). Your role is to explain how these two layers of analysis work together to create high-probability setups.

Key principles:
- Chart patterns define the SETUP (structure, context, where the stock is going)
- Candlestick patterns define the TRIGGER (timing, entry point, when to act)
- Both must align for the strongest signals
- Use clear, educational language that helps traders understand WHY patterns matter
- Be factual and data-driven - no hype
- Highlight both opportunities AND risks`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1800
      });

      const response = completion.choices[0].message.content || "";
      
      return this.parseAIResponse(response, indicators, compositePattern.candlestickPattern, score);
    } catch (error) {
      console.error("Error generating composite AI analysis:", error);
      
      // Fallback to rule-based analysis
      return this.generateFallbackCompositeAnalysis(symbol, indicators, compositePattern, score, risk);
    }
  }

  /**
   * Build prompt for composite analysis
   */
  private buildCompositePrompt(
    symbol: string,
    timeframe: string,
    indicators: TechnicalIndicators,
    compositePattern: CompositePattern,
    score: SetupScore,
    risk: RiskManagementPlan
  ): string {
    const { candlestickPattern, chartPattern, fusedConfidence, fusionBonus, analysis } = compositePattern;
    
    let prompt = `Analyze this swing trading setup for ${symbol} on ${timeframe} timeframe:

CANDLESTICK PATTERN (TIMING):
- ${candlestickPattern.name} (${candlestickPattern.type}, ${candlestickPattern.confidence}% confidence)
- ${candlestickPattern.description}
- Role: Entry trigger and immediate price action signal
`;

    if (chartPattern) {
      prompt += `
CHART PATTERN (STRUCTURE):
- ${chartPattern.name} (${chartPattern.type}, ${chartPattern.confidence}% confidence)
- ${chartPattern.description}
- Breakout Status: ${chartPattern.breakoutStatus}
- Volume Confirmation: ${chartPattern.volumeConfirmation ? 'Yes' : 'No'}
${chartPattern.priceTarget ? `- Price Target: $${chartPattern.priceTarget.toFixed(2)}` : ''}
${chartPattern.metadata?.tightness ? `- Pattern Tightness: ${chartPattern.metadata.tightness}% (higher = coiled for move)` : ''}
- Role: Defines market structure and expected move size

PATTERN FUSION ANALYSIS:
- Fused Confidence: ${fusedConfidence}% (from ${candlestickPattern.confidence}% and ${chartPattern.confidence}%)
- Fusion Bonus: ${fusionBonus > 0 ? '+' : ''}${fusionBonus} points ${fusionBonus > 0 ? '(patterns align ✓)' : fusionBonus < 0 ? '(patterns conflict ⚠)' : '(neutral)'}
- ${analysis}
`;
    } else {
      prompt += `
CHART PATTERN (STRUCTURE):
- None detected - no clear macro structure pattern
- Relying on candlestick signal and support/resistance levels
- Role: Focus on immediate technical levels
`;
    }

    prompt += `
TECHNICAL INDICATORS:
- EMA9: ${indicators.ema9.toFixed(2)}
- EMA20: ${indicators.ema20.toFixed(2)}
- EMA50: ${indicators.ema50.toFixed(2)}
- EMA200: ${indicators.ema200.toFixed(2)}
- RSI: ${indicators.rsi.toFixed(1)}
- MACD: ${indicators.macd.value.toFixed(2)} (Signal: ${indicators.macd.signal.toFixed(2)})
- Volume Z-Score: ${indicators.volumeZScore.toFixed(2)}
- Trend: ${indicators.trend} (Strength: ${indicators.strength})

SETUP SCORE:
- Overall: ${score.overall}/100 (${score.rating})
- Technical: ${score.technical}/100
- Momentum: ${score.momentum}/100
- Pattern: ${score.pattern}/100

RISK MANAGEMENT:
- Entry: $${risk.entry}
- Stop Loss: $${risk.stopLoss}
- Targets: $${risk.targets.target1} / $${risk.targets.target2} / $${risk.targets.target3}

Provide THREE sections:

1. NARRATIVE (4-5 sentences): 
   - Start by explaining the chart pattern context (the SETUP/STRUCTURE)
   - Then explain how the candlestick pattern confirms timing (the TRIGGER)
   - Connect the dots: why do these patterns work together (or conflict)?
   - What is the expected move based on this combination?

2. MENTOR NOTES (5-6 points):
   - Explain what the chart pattern tells us about where price is likely headed
   - Explain what the candlestick tells us about entry timing
   - Why volume matters for pattern confirmation
   - What EMA alignment tells us about trend context
   - How to manage risk on this type of setup

3. KEY FACTORS:
   - List 2-3 STRENGTHS (why this setup has potential)
   - List 2-3 WARNINGS (risks to watch)
   - List 2-3 RULES (what criteria fired - be specific)

Be educational and factual. Help traders understand the "why" behind the patterns.`;

    return prompt;
  }

  /**
   * Generate fallback composite analysis
   */
  private generateFallbackCompositeAnalysis(
    symbol: string,
    indicators: TechnicalIndicators,
    compositePattern: CompositePattern,
    score: SetupScore,
    risk: RiskManagementPlan
  ): AIAnalysis {
    const { candlestickPattern, chartPattern, analysis } = compositePattern;
    
    let narrative = "";
    if (chartPattern) {
      narrative = `${chartPattern.name} chart pattern provides the structural context for this ${symbol} setup, showing ${chartPattern.type} bias with ${chartPattern.confidence}% confidence. `;
      narrative += `The pattern is currently ${chartPattern.breakoutStatus} with ${chartPattern.volumeConfirmation ? 'strong' : 'weak'} volume confirmation. `;
      narrative += `${candlestickPattern.name} candlestick pattern confirms entry timing with ${candlestickPattern.confidence}% confidence. `;
      narrative += analysis;
    } else {
      narrative = `No major chart pattern detected for ${symbol}. Analysis relies on ${candlestickPattern.name} candlestick signal (${candlestickPattern.confidence}% confidence) and immediate support/resistance levels. ${indicators.trend} trend context with RSI at ${indicators.rsi.toFixed(1)}. Overall score: ${score.overall}/100.`;
    }

    const mentorNotes = chartPattern
      ? `Chart Structure: ${chartPattern.name} defines the expected price path and provides ${chartPattern.priceTarget ? `target of $${chartPattern.priceTarget.toFixed(2)}` : 'directional bias'}.\n\nEntry Timing: ${candlestickPattern.name} signals when to enter based on immediate price action.\n\nVolume Analysis: ${chartPattern.volumeConfirmation ? 'Strong volume confirms the pattern validity' : 'Low volume suggests caution - wait for volume confirmation'}.\n\nTrend Context: Price is ${indicators.trend} with strength ${indicators.strength}/100. EMAs show ${indicators.ema9 > indicators.ema20 ? 'bullish' : 'bearish'} short-term alignment.\n\nRisk Management: Stop at $${risk.stopLoss} protects against invalidation. Targets at ${risk.riskReward.target1.toFixed(1)}:1, ${risk.riskReward.target2.toFixed(1)}:1, ${risk.riskReward.target3.toFixed(1)}:1 R:R ratios.`
      : this.getDefaultMentorNotes(indicators);

    const reasoning: string[] = [
      `Candlestick: ${candlestickPattern.name} (${candlestickPattern.confidence}%)`,
    ];
    
    if (chartPattern) {
      reasoning.push(`Chart Pattern: ${chartPattern.name} (${chartPattern.confidence}%)`);
      reasoning.push(`Breakout Status: ${chartPattern.breakoutStatus}`);
      reasoning.push(`Pattern Fusion: ${compositePattern.fusionBonus > 0 ? 'Aligned' : compositePattern.fusionBonus < 0 ? 'Conflicting' : 'Neutral'} (${compositePattern.fusionBonus > 0 ? '+' : ''}${compositePattern.fusionBonus})`);
    } else {
      reasoning.push('No chart pattern - focus on candlestick + S/R');
    }
    
    reasoning.push(...this.getDefaultReasoning(indicators, candlestickPattern).slice(1));

    const warnings = this.getDefaultWarnings(indicators, candlestickPattern, score);
    if (chartPattern && !chartPattern.volumeConfirmation) {
      warnings.unshift("Low volume on chart pattern - wait for confirmation");
    }
    if (compositePattern.fusionBonus < 0) {
      warnings.unshift("Chart and candlestick patterns conflict - proceed with caution");
    }

    const strengths = chartPattern
      ? [
          `${chartPattern.name} provides clear structural bias`,
          compositePattern.fusionBonus > 10 ? 'Strong pattern alignment (+15 confidence)' : 'Pattern fusion detected',
          chartPattern.breakoutStatus === 'confirmed' ? 'Breakout confirmed with volume' : `Breakout ${chartPattern.breakoutStatus}`,
          ...this.getDefaultStrengths(indicators, candlestickPattern, score)
        ].slice(0, 3)
      : this.getDefaultStrengths(indicators, candlestickPattern, score);

    return {
      narrative,
      mentorNotes,
      reasoning,
      warnings: warnings.slice(0, 3),
      strengths
    };
  }
}

