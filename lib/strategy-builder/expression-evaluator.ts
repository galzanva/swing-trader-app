/**
 * Expression Evaluator for Dynamic Levels
 * 
 * Evaluates expressions like "ema20-0.5*ATR" or "entry+1.5*ATR"
 */

export interface EvaluationContext {
  // Price data
  price: number;
  high: number[];
  low: number[];
  close: number[];
  open?: number[];
  
  // Technical indicators
  ema9?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi14?: number;
  atr?: number;
  volZ?: number;
  
  // Entry/Stop (for target calculations)
  entry?: number;
  stop?: number;
  
  // Custom EMAs
  [key: `ema${number}`]: number | undefined;
}

/**
 * Evaluate a level expression to a numeric value
 */
export function evaluateExpression(
  expr: string,
  context: EvaluationContext
): number {
  // Handle simple numeric values
  if (/^\d+(\.\d+)?$/.test(expr)) {
    return parseFloat(expr);
  }
  
  // Replace variables with values
  let expression = expr.toLowerCase().trim();
  
  // Replace context variables
  const replacements: Record<string, number | undefined> = {
    price: context.price,
    entry: context.entry,
    stop: context.stop,
    atr: context.atr,
    ema9: context.ema9,
    ema20: context.ema20,
    ema50: context.ema50,
    ema200: context.ema200,
    rsi14: context.rsi14,
    volz: context.volZ,
    high: context.high[context.high.length - 1],
    low: context.low[context.low.length - 1],
    close: context.close[context.close.length - 1],
    open: context.open?.[context.open.length - 1],
  };
  
  // Replace custom EMAs (ema5, ema100, etc.)
  for (const key of Object.keys(context)) {
    if (key.startsWith('ema') && key.match(/^ema\d+$/)) {
      const value = context[key as keyof EvaluationContext];
      if (typeof value === 'number') {
        replacements[key] = value;
      }
    }
  }
  
  // Replace variables in expression
  for (const [varName, value] of Object.entries(replacements)) {
    if (value !== undefined) {
      expression = expression.replace(
        new RegExp(`\\b${varName}\\b`, 'g'),
        value.toString()
      );
    }
  }
  
  // Check for unresolved variables
  if (/\b[a-z_][a-z0-9_]*\b/i.test(expression)) {
    throw new Error(`Unresolved variables in expression: ${expression}`);
  }
  
  // Safely evaluate the mathematical expression
  try {
    return evaluateMathExpression(expression);
  } catch (error) {
    throw new Error(`Failed to evaluate expression "${expr}": ${(error as Error).message}`);
  }
}

/**
 * Safely evaluate a mathematical expression
 * Uses Function constructor with restricted scope
 */
function evaluateMathExpression(expr: string): number {
  // Whitelist only safe math operations
  const sanitized = expr.replace(/[^0-9+\-*/.()]/g, '');
  
  if (sanitized !== expr) {
    throw new Error('Expression contains invalid characters');
  }
  
  // Evaluate using Function constructor (safer than eval)
  try {
    const result = new Function(`return ${sanitized}`)();
    
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Expression did not produce a valid number');
    }
    
    return result;
  } catch (error) {
    throw new Error(`Math evaluation failed: ${(error as Error).message}`);
  }
}

/**
 * Validate an expression without evaluating it
 */
export function validateExpression(expr: string): { 
  valid: boolean; 
  error?: string;
  variables: string[];
} {
  try {
    // Extract variables from expression
    const variables: string[] = [];
    const varPattern = /\b([a-z_][a-z0-9_]*)\b/gi;
    let match;
    
    while ((match = varPattern.exec(expr)) !== null) {
      if (!variables.includes(match[1].toLowerCase())) {
        variables.push(match[1].toLowerCase());
      }
    }
    
    // Check if it's a simple number
    if (/^\d+(\.\d+)?$/.test(expr)) {
      return { valid: true, variables: [] };
    }
    
    // Check for valid variable names
    const validVars = [
      'price', 'entry', 'stop', 'atr', 'high', 'low', 'close', 'open',
      'volz', 'rsi14', 'ema9', 'ema20', 'ema50', 'ema200'
    ];
    
    const invalidVars = variables.filter(v => 
      !validVars.includes(v) && !/^ema\d+$/.test(v)
    );
    
    if (invalidVars.length > 0) {
      return {
        valid: false,
        error: `Invalid variables: ${invalidVars.join(', ')}`,
        variables,
      };
    }
    
    // Check for valid math operators
    const mathOnly = expr.replace(/[a-z_][a-z0-9_]*/gi, '1');
    if (!/^[\d+\-*/.()]+$/.test(mathOnly)) {
      return {
        valid: false,
        error: 'Expression contains invalid characters',
        variables,
      };
    }
    
    return { valid: true, variables };
  } catch (error) {
    return {
      valid: false,
      error: (error as Error).message,
      variables: [],
    };
  }
}

/**
 * Get description of an expression in plain English
 */
export function describeExpression(expr: string): string {
  if (/^\d+(\.\d+)?$/.test(expr)) {
    return `$${parseFloat(expr).toFixed(2)}`;
  }
  
  // Common patterns
  const patterns = [
    { regex: /^entry\s*\+\s*(\d+(?:\.\d+)?)\s*\*\s*atr$/i, desc: (m: string[]) => `Entry + ${m[1]}× ATR` },
    { regex: /^entry\s*-\s*(\d+(?:\.\d+)?)\s*\*\s*atr$/i, desc: (m: string[]) => `Entry − ${m[1]}× ATR` },
    { regex: /^ema(\d+)\s*\+\s*(\d+(?:\.\d+)?)\s*\*\s*atr$/i, desc: (m: string[]) => `EMA${m[1]} + ${m[2]}× ATR` },
    { regex: /^ema(\d+)\s*-\s*(\d+(?:\.\d+)?)\s*\*\s*atr$/i, desc: (m: string[]) => `EMA${m[1]} − ${m[2]}× ATR` },
    { regex: /^ema(\d+)$/i, desc: (m: string[]) => `EMA${m[1]}` },
    { regex: /^price$/i, desc: () => 'Current Price' },
    { regex: /^high$/i, desc: () => 'Current High' },
    { regex: /^low$/i, desc: () => 'Current Low' },
  ];
  
  for (const pattern of patterns) {
    const match = expr.match(pattern.regex);
    if (match) {
      return pattern.desc(match);
    }
  }
  
  return expr; // Fallback to raw expression
}
