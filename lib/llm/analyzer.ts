/**
 * OpenAI LLM Analyzer
 * Generates expert analysis and mentor insights
 */

import OpenAI from "openai";
import { TechnicalIndicators } from "../indicators/technical";
import { DetectedPattern } from "../patterns/detector";
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
   * Extract bullet points from text
   */
  private extractBulletPoints(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(line => line.length > 0 && !line.match(/^(NARRATIVE|MENTOR|KEY|STRENGTHS|WARNINGS|RULES)/i))
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
}

