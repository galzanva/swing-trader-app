/**
 * Seed System Strategies
 * 
 * Adds the 6 core strategies as "system strategies" that users can activate/deactivate
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_STRATEGIES = [
  {
    name: '🔺 Triangle Breakout',
    description: 'Ascending/descending triangle with volume expansion on breakout',
    direction: 'long' as const,
    timeframe: '1day' as const,
    priority: -100, // Negative priority = system strategy (lower than user strategies)
    dsl: {
      name: '🔺 Triangle Breakout',
      description: 'System strategy: Triangle pattern breakout with volume confirmation',
      direction: 'long' as const,
      timeframe: '1day' as const,
      eligibility: {
        chartPattern: {
          type: 'triangle' as const,
          direction: 'any' as const,
          status: 'institutional' as const,
          lookbackBars: 50,
        },
        volumeRule: {
          type: 'z-score' as const,
          threshold: 0.5,
          operator: '>=' as const,
        },
      },
      trigger: {
        type: 'breakout' as const,
        level: 'high',
        description: 'Price breaks above triangle resistance',
      },
      stop: {
        type: 'swing' as const,
        value: 'low-0.5*ATR',
      },
      targets: [
        { level: 'entry+1.5*ATR', label: 'T1' },
        { level: 'entry+2.5*ATR', label: 'T2' },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
  {
    name: '🚩 Flag Breakout',
    description: 'Bullish/bearish flag with tight consolidation and volume breakout',
    direction: 'long' as const,
    timeframe: '1day' as const,
    priority: -99,
    dsl: {
      name: '🚩 Flag Breakout',
      description: 'System strategy: Flag pattern breakout',
      direction: 'long' as const,
      timeframe: '1day' as const,
      eligibility: {
        chartPattern: {
          type: 'flag' as const,
          direction: 'bullish' as const,
          status: 'institutional' as const,
          lookbackBars: 50,
        },
        volumeRule: {
          type: 'z-score' as const,
          threshold: 0.5,
          operator: '>=' as const,
        },
      },
      trigger: {
        type: 'breakout' as const,
        level: 'high',
        description: 'Price breaks above flag resistance',
      },
      stop: {
        type: 'swing' as const,
        value: 'low-0.5*ATR',
      },
      targets: [
        { level: 'entry+1.5*ATR', label: 'T1' },
        { level: 'entry+2.5*ATR', label: 'T2' },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
  {
    name: '📉 Double Top',
    description: 'Double top pattern with volume divergence',
    direction: 'short' as const,
    timeframe: '1day' as const,
    priority: -98,
    dsl: {
      name: '📉 Double Top',
      description: 'System strategy: Double top reversal pattern',
      direction: 'short' as const,
      timeframe: '1day' as const,
      eligibility: {
        chartPattern: {
          type: 'double_top' as const,
          direction: 'bearish' as const,
          status: 'institutional' as const,
          lookbackBars: 50,
        },
      },
      trigger: {
        type: 'reversal' as const,
        level: 'low',
        description: 'Price breaks below neckline',
      },
      stop: {
        type: 'swing' as const,
        value: 'high+0.5*ATR',
      },
      targets: [
        { level: 'entry-1.5*ATR', label: 'T1' },
        { level: 'entry-2.5*ATR', label: 'T2' },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
  {
    name: '📊 Trend Pullback',
    description: 'EMA-based pullback in strong trend with reversal candle',
    direction: 'long' as const,
    timeframe: '1day' as const,
    priority: -97,
    dsl: {
      name: '📊 Trend Pullback',
      description: 'System strategy: Strict pullback in uptrend',
      direction: 'long' as const,
      timeframe: '1day' as const,
      eligibility: {
        emaRules: [
          { ema1: 20, operator: '>' as const, ema2: 50 },
          { ema1: 50, operator: '>' as const, ema2: 200 },
        ],
        priceDistance: {
          fromLevel: 'ema20',
          maxDistance: 0.5,
          unit: 'atr' as const,
        },
        candlePattern: {
          name: 'any_bullish' as const,
        },
      },
      trigger: {
        type: 'pullback' as const,
        level: 'ema20',
        description: 'Entry near EMA20 after pullback',
      },
      stop: {
        type: 'atr' as const,
        value: 'ema20-0.5*ATR',
      },
      targets: [
        { level: 'entry+1.5*ATR', label: 'T1' },
        { level: 'entry+2.5*ATR', label: 'T2' },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
  {
    name: '↩️ Mean Reversion',
    description: 'Oversold bounce from EMA200 in downtrend',
    direction: 'long' as const,
    timeframe: '1day' as const,
    priority: -96,
    dsl: {
      name: '↩️ Mean Reversion',
      description: 'System strategy: Oversold bounce setup',
      direction: 'long' as const,
      timeframe: '1day' as const,
      eligibility: {
        rsiRange: {
          period: 14,
          min: 0,
          max: 30,
        },
        priceDistance: {
          fromLevel: 'ema200',
          maxDistance: 1,
          unit: 'atr' as const,
        },
      },
      trigger: {
        type: 'reversal' as const,
        level: 'ema200',
        description: 'Bounce from EMA200 support',
      },
      stop: {
        type: 'atr' as const,
        value: 'entry-1*ATR',
      },
      targets: [
        { level: 'entry+1.5*ATR', label: 'T1' },
        { level: 'entry+2*ATR', label: 'T2' },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
  {
    name: '💥 Failed Breakout',
    description: 'False breakout reversal (fakeout trap)',
    direction: 'short' as const,
    timeframe: '1day' as const,
    priority: -95,
    dsl: {
      name: '💥 Failed Breakout',
      description: 'System strategy: Fakeout reversal',
      direction: 'short' as const,
      timeframe: '1day' as const,
      eligibility: {
        candlePattern: {
          name: 'shooting_star' as const,
        },
        volumeRule: {
          type: 'z-score' as const,
          threshold: 0.5,
          operator: '>=' as const,
        },
      },
      trigger: {
        type: 'reversal' as const,
        level: 'low',
        description: 'Failed breakout reversal',
      },
      stop: {
        type: 'swing' as const,
        value: 'high+0.5*ATR',
      },
      targets: [
        { level: 'entry-1.5*ATR', label: 'T1' },
        { level: 'entry-2.5*ATR', label: 'T2' },
      ],
      riskManagement: {
        minRR: 1.5,
        maxPositionSize: 2,
        earningsDaysBuffer: 3,
      },
    },
  },
];

async function main() {
  console.log('🌱 Seeding system strategies...\n');

  // Get all existing users
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    console.log('⚠️  No users found. Please create a user first.');
    return;
  }

  console.log(`Found ${users.length} user(s)\n`);

  for (const user of users) {
    console.log(`📥 Seeding strategies for ${user.email}...`);

    for (const strategy of SYSTEM_STRATEGIES) {
      // Check if strategy already exists for this user
      const existing = await prisma.userStrategy.findFirst({
        where: {
          userId: user.id,
          name: strategy.name,
        },
      });

      if (existing) {
        console.log(`  ⏭️  ${strategy.name} already exists, skipping`);
        continue;
      }

      // Create system strategy
      await prisma.userStrategy.create({
        data: {
          userId: user.id,
          name: strategy.name,
          description: strategy.description,
          direction: strategy.direction,
          timeframe: strategy.timeframe,
          dsl: strategy.dsl as any,
          isActive: true, // Active by default
          priority: strategy.priority, // Negative = system strategy
        },
      });

      console.log(`  ✅ ${strategy.name} created`);
    }

    console.log('');
  }

  console.log('🎉 System strategies seeded successfully!');
  console.log('\n📌 Note: System strategies have negative priority (-100 to -95)');
  console.log('📌 User strategies have priority ≥ 0 (higher priority = evaluated first)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding strategies:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

