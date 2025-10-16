/**
 * User Strategy Repository
 * 
 * Database operations for user-defined strategies
 */

import { PrismaClient } from '@prisma/client';
import type { StrategyDsl } from './dsl-schema';
import { validateStrategyDsl } from './dsl-schema';

// Use global prisma instance in development to avoid connection limit issues
// but allow hot reloading to pick up database changes
const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export interface UserStrategyRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  dsl: StrategyDsl;
  direction: string;
  timeframe: string;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  useCount: number;
}

/**
 * Create a new user strategy
 */
export async function createUserStrategy(
  userId: string,
  name: string,
  dsl: unknown,
  description?: string
): Promise<{ success: boolean; data?: UserStrategyRecord; error?: string }> {
  // Validate DSL
  const validation = validateStrategyDsl(dsl);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid strategy DSL: ${validation.errors?.join(', ')}`,
    };
  }
  
  const validDsl = validation.data!;
  
  try {
    const strategy = await prisma.userStrategy.create({
      data: {
        userId,
        name,
        description: description || null,
        dsl: validDsl as any, // Prisma Json type
        direction: validDsl.direction,
        timeframe: validDsl.timeframe,
        isActive: true,
        priority: 0,
      },
    });
    
    return {
      success: true,
      data: {
        ...strategy,
        dsl: validDsl,
      },
    };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return {
        success: false,
        error: 'A strategy with this name already exists',
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to create strategy',
    };
  }
}

/**
 * Get user's active strategies (sorted by priority)
 */
export async function getUserStrategies(
  userId: string,
  activeOnly: boolean = true
): Promise<UserStrategyRecord[]> {
  // Force a fresh query by disconnecting and reconnecting
  // This ensures we get the latest data from the database
  try {
    await prisma.$disconnect();
  } catch (e) {
    // Ignore disconnect errors
  }
  
  const strategies = await prisma.userStrategy.findMany({
    where: {
      userId,
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: [
      { priority: 'desc' },
      { lastUsedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });
  
  return strategies.map(s => ({
    ...s,
    dsl: s.dsl as StrategyDsl,
  }));
}

/**
 * Get a specific user strategy
 */
export async function getUserStrategy(
  userId: string,
  strategyId: string
): Promise<UserStrategyRecord | null> {
  const strategy = await prisma.userStrategy.findFirst({
    where: {
      id: strategyId,
      userId,
    },
  });
  
  if (!strategy) return null;
  
  return {
    ...strategy,
    dsl: strategy.dsl as StrategyDsl,
  };
}

/**
 * Update a user strategy
 */
export async function updateUserStrategy(
  userId: string,
  strategyId: string,
  updates: {
    name?: string;
    description?: string | null;
    dsl?: unknown;
    isActive?: boolean;
    priority?: number;
  }
): Promise<{ success: boolean; data?: UserStrategyRecord; error?: string }> {
  // Validate DSL if provided
  let validDsl: StrategyDsl | undefined;
  if (updates.dsl) {
    const validation = validateStrategyDsl(updates.dsl);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid strategy DSL: ${validation.errors?.join(', ')}`,
      };
    }
    validDsl = validation.data!;
  }
  
  try {
    const strategy = await prisma.userStrategy.update({
      where: {
        id: strategyId,
        userId, // Ensure user owns the strategy
      },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(validDsl && {
          dsl: validDsl as any,
          direction: validDsl.direction,
          timeframe: validDsl.timeframe,
        }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
      },
    });
    
    return {
      success: true,
      data: {
        ...strategy,
        dsl: (validDsl || strategy.dsl) as StrategyDsl,
      },
    };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return {
        success: false,
        error: 'A strategy with this name already exists',
      };
    }
    if (error.code === 'P2025') {
      return {
        success: false,
        error: 'Strategy not found',
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to update strategy',
    };
  }
}

/**
 * Delete a user strategy
 */
export async function deleteUserStrategy(
  userId: string,
  strategyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.userStrategy.delete({
      where: {
        id: strategyId,
        userId, // Ensure user owns the strategy
      },
    });
    
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2025') {
      return {
        success: false,
        error: 'Strategy not found',
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to delete strategy',
    };
  }
}

/**
 * Increment strategy use count and update lastUsedAt
 */
export async function trackStrategyUsage(strategyId: string): Promise<void> {
  await prisma.userStrategy.update({
    where: { id: strategyId },
    data: {
      useCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Toggle strategy active status
 */
export async function toggleStrategyActive(
  userId: string,
  strategyId: string
): Promise<{ success: boolean; isActive?: boolean; error?: string }> {
  try {
    const current = await prisma.userStrategy.findFirst({
      where: { id: strategyId, userId },
      select: { isActive: true },
    });
    
    if (!current) {
      return { success: false, error: 'Strategy not found' };
    }
    
    const updated = await prisma.userStrategy.update({
      where: { id: strategyId },
      data: { isActive: !current.isActive },
    });
    
    return { success: true, isActive: updated.isActive };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to toggle strategy status',
    };
  }
}
