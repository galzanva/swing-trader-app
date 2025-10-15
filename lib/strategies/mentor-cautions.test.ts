/**
 * Validation tests for contextual caution generation in mentor output
 * Run with: npx ts-node lib/strategies/mentor-cautions.test.ts
 */

import { StrategyEvaluation, HistoricalRecent } from './types';
import { generateContextualCautions, generateStrongestCaution } from './mentor';

// Mock evaluation factory
function createMockEvaluation(overrides: Partial<StrategyEvaluation> = {}): StrategyEvaluation {
  return {
    symbol: 'TEST',
    timeframe: '1D',
    asOf: '2024-01-15',
    strategy: 'triangle_breakout_long',
    status: 'ready',
    plan: {
      direction: 'long',
      trigger: { type: 'breakout', level: 100, description: 'Break above resistance' },
      entry: 100,
      stop: 95,
      targets: [{ level: 105, rr: 1.0 }, { level: 110, rr: 2.0 }],
      invalidationRules: ['Break below 95']
    },
    quality: 0.8,
    viability: 0.7,
    rrFirst: 2.0,
    reasons: ['Strong breakout pattern'],
    metadata: {},
    ...overrides
  };
}

// Mock historical data factory
function createMockHistorical(overrides: Partial<HistoricalRecent> = {}): HistoricalRecent {
  return {
    samples: 15,
    hasMinSamples: true,
    winRate5d: 0.6,
    winRate10d: 0.7,
    winRate20d: 0.8,
    avgPnL5d: 0.02,
    avgPnL10d: 0.03,
    avgPnL20d: 0.04,
    firstTouchT1: 5,
    firstTouchT2: 6,
    firstTouchT3: 3,
    firstTouchStop: 1,
    avgDaysHeld: 5.0,
    isWeakHistory: false,
    dataLastRefreshedAt: new Date(),
    dataAgeHours: 2,
    ...overrides
  };
}

// Simple assertion helper
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Test functions
function testInsufficientSampleWarning(): void {
  console.log('Testing insufficient sample warning...');
  const evaluation = createMockEvaluation({
    historicalRecent: createMockHistorical({ samples: 5, hasMinSamples: false })
  });
  
  const cautions = generateContextualCautions(evaluation);
  assert(cautions.includes('Insufficient sample—do not rely on win rate'), 
    'Should show insufficient sample warning when samples < 10');
  console.log('✓ Passed');
}

function testStopFirstDominanceWarning(): void {
  console.log('Testing stop-first dominance warning...');
  const evaluation = createMockEvaluation({
    historicalRecent: createMockHistorical({ 
      samples: 10, 
      firstTouchStop: 6, // 60% stop first
      firstTouchT1: 2,
      firstTouchT2: 1,
      firstTouchT3: 1
    })
  });
  
  const cautions = generateContextualCautions(evaluation);
  assert(cautions.includes('Most historical trades hit stop first—treat as high-risk or scalp-only'), 
    'Should show stop-first dominance warning when stopFirst >= 50%');
  console.log('✓ Passed');
}

function testShortHoldingPeriodWarning(): void {
  console.log('Testing short holding period warning...');
  const evaluation = createMockEvaluation({
    historicalRecent: createMockHistorical({ avgDaysHeld: 1.5 })
  });
  
  const cautions = generateContextualCautions(evaluation);
  assert(cautions.includes('Typically resolves within ~1–2 days—shorter holding horizon recommended'), 
    'Should show short holding period warning when avgDaysHeld <= 2');
  console.log('✓ Passed');
}

function testVolumeConfirmationRequirement(): void {
  console.log('Testing volume confirmation requirement...');
  const evaluation = createMockEvaluation({
    metadata: { volZ: -0.5 }
  });
  
  const cautions = generateContextualCautions(evaluation);
  assert(cautions.includes('Confirmation must include a volume uptick (volZ ≥ 0)'), 
    'Should show volume confirmation requirement when volZ < 0');
  console.log('✓ Passed');
}

function testFrontLoadedEdgeWarning(): void {
  console.log('Testing front-loaded edge warning...');
  const evaluation = createMockEvaluation({
    historicalRecent: createMockHistorical({
      winRate5d: 0.8,   // High early
      winRate10d: 0.6,  // Declines
      winRate20d: 0.4   // Declines further
    })
  });
  
  const cautions = generateContextualCautions(evaluation);
  assert(cautions.includes('Edge is front-loaded—favor quick exits'), 
    'Should show front-loaded edge warning when win rates decline over time');
  console.log('✓ Passed');
}

function testMinimumRRWarning(): void {
  console.log('Testing minimum R:R warning...');
  const evaluation = createMockEvaluation({
    rrFirst: 1.4
  });
  
  const cautions = generateContextualCautions(evaluation);
  assert(cautions.includes('Reward-to-risk at minimum—avoid chasing entry/size down'), 
    'Should show minimum R:R warning when rrFirst <= 1.5');
  console.log('✓ Passed');
}

function testProfitProtectionWarning(): void {
  console.log('Testing profit protection warning...');
  const evaluation = createMockEvaluation({
    historicalRecent: createMockHistorical({
      winRate10d: 0.7,  // Good win rate
      firstTouchStop: 4, // 40% stop first (out of 10 samples)
      samples: 10
    })
  });
  
  const cautions = generateContextualCautions(evaluation);
  assert(cautions.includes('Short-term pops often fade—protect profits early'), 
    'Should show profit protection warning when good win rates but high stop rate');
  console.log('✓ Passed');
}

function testNoCautionsWhenConditionsNotMet(): void {
  console.log('Testing no cautions when conditions not met...');
  const evaluation = createMockEvaluation({
    historicalRecent: createMockHistorical({
      samples: 15,
      hasMinSamples: true,
      firstTouchStop: 2, // Low stop rate
      avgDaysHeld: 8.0,
      winRate5d: 0.5,
      winRate10d: 0.6,
      winRate20d: 0.7,
      isWeakHistory: false
    }),
    rrFirst: 2.5,
    metadata: { volZ: 0.5 }
  });
  
  const cautions = generateContextualCautions(evaluation);
  assert(cautions === '', 'Should return empty string when no cautions apply');
  console.log('✓ Passed');
}

function testStrongestCautionPriority(): void {
  console.log('Testing strongest caution priority...');
  
  // Test insufficient sample priority
  const evaluation1 = createMockEvaluation({
    historicalRecent: createMockHistorical({
      samples: 5,
      hasMinSamples: false,
      firstTouchStop: 3, // High stop rate
      isWeakHistory: true
    }),
    rrFirst: 1.2
  });
  
  const strongest1 = generateStrongestCaution(evaluation1);
  assert(strongest1 === 'Limited sample size—statistics unreliable', 
    'Should prioritize insufficient sample as strongest caution');
  
  // Test high stop-first rate priority when sample is sufficient
  const evaluation2 = createMockEvaluation({
    historicalRecent: createMockHistorical({
      samples: 15,
      hasMinSamples: true,
      firstTouchStop: 8, // 53% stop first
      isWeakHistory: false
    }),
    rrFirst: 1.2
  });
  
  const strongest2 = generateStrongestCaution(evaluation2);
  assert(strongest2 === 'High stop-first rate—scalp-only or avoid', 
    'Should prioritize high stop-first rate when sample is sufficient');
  
  console.log('✓ Passed');
}

function testNoHistoricalData(): void {
  console.log('Testing no historical data...');
  const evaluation = createMockEvaluation({
    historicalRecent: undefined
  });
  
  const strongest = generateStrongestCaution(evaluation);
  assert(strongest === 'No historical precedent—maximum caution advised', 
    'Should handle no historical data');
  console.log('✓ Passed');
}

// Main test runner
function runAllTests(): void {
  console.log('Running contextual caution tests...\n');
  
  try {
    testInsufficientSampleWarning();
    testStopFirstDominanceWarning();
    testShortHoldingPeriodWarning();
    testVolumeConfirmationRequirement();
    testFrontLoadedEdgeWarning();
    testMinimumRRWarning();
    testProfitProtectionWarning();
    testNoCautionsWhenConditionsNotMet();
    testStrongestCautionPriority();
    testNoHistoricalData();
    
    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', (error as Error).message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

// Export for potential use in other test files
export { createMockEvaluation, createMockHistorical };