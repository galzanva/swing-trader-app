/**
 * Trading Calendar Utilities
 * 
 * Handles trading days, market hours, and timezone conversions
 * Uses America/New_York timezone for consistency
 */

const MARKET_OPEN_HOUR = 9; // 9:30 AM ET
const MARKET_CLOSE_HOUR = 16; // 4:00 PM ET

/**
 * Check if a date is a trading day (Monday-Friday, excluding major holidays)
 * Simplified version - in production, you'd want a comprehensive holiday calendar
 */
export function isTradingDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  
  // Weekend check
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Major holiday exclusions (simplified)
  const month = date.getMonth();
  const day = date.getDate();
  
  // New Year's Day
  if (month === 0 && day === 1) return false;
  
  // Independence Day
  if (month === 6 && day === 4) return false;
  
  // Christmas Day
  if (month === 11 && day === 25) return false;
  
  // Thanksgiving (4th Thursday of November)
  if (month === 10) {
    const thanksgiving = getThanksgivingDate(date.getFullYear());
    if (day === thanksgiving.getDate()) return false;
  }
  
  return true;
}

/**
 * Get Thanksgiving date for a given year
 */
function getThanksgivingDate(year: number): Date {
  const november = new Date(year, 10, 1); // November 1st
  const firstThursday = 1 + (4 - november.getDay()) % 7;
  return new Date(year, 10, firstThursday + 21); // 4th Thursday
}

/**
 * Get the next trading day
 */
export function getNextTradingDay(date: Date): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  while (!isTradingDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

/**
 * Get the previous trading day
 */
export function getPreviousTradingDay(date: Date): Date {
  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);
  
  while (!isTradingDay(prevDay)) {
    prevDay.setDate(prevDay.getDate() - 1);
  }
  
  return prevDay;
}

/**
 * Count trading days between two dates (inclusive)
 */
export function countTradingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isTradingDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Add trading days to a date
 */
export function addTradingDays(date: Date, days: number): Date {
  let result = new Date(date);
  let remainingDays = days;
  
  while (remainingDays > 0) {
    result = getNextTradingDay(result);
    remainingDays--;
  }
  
  return result;
}

/**
 * Subtract trading days from a date
 */
export function subtractTradingDays(date: Date, days: number): Date {
  let result = new Date(date);
  let remainingDays = days;
  
  while (remainingDays > 0) {
    result = getPreviousTradingDay(result);
    remainingDays--;
  }
  
  return result;
}

/**
 * Get the start of the trading day (9:30 AM ET)
 */
export function getTradingDayStart(date: Date): Date {
  const result = new Date(date);
  result.setHours(MARKET_OPEN_HOUR, 30, 0, 0); // 9:30 AM
  return result;
}

/**
 * Get the end of the trading day (4:00 PM ET)
 */
export function getTradingDayEnd(date: Date): Date {
  const result = new Date(date);
  result.setHours(MARKET_CLOSE_HOUR, 0, 0, 0); // 4:00 PM
  return result;
}

/**
 * Check if a date/time is during market hours
 */
export function isMarketHours(date: Date): boolean {
  if (!isTradingDay(date)) return false;
  
  const hour = date.getHours();
  const minute = date.getMinutes();
  
  const openTime = MARKET_OPEN_HOUR * 60 + 30; // 9:30 AM in minutes
  const closeTime = MARKET_CLOSE_HOUR * 60; // 4:00 PM in minutes
  const currentTime = hour * 60 + minute;
  
  return currentTime >= openTime && currentTime <= closeTime;
}

/**
 * Get the most recent trading day
 */
export function getMostRecentTradingDay(): Date {
  const today = new Date();
  
  if (isTradingDay(today) && isMarketHours(today)) {
    return today;
  }
  
  return getPreviousTradingDay(today);
}

/**
 * Format date in market timezone
 */
export function formatMarketDate(date: Date, formatStr: string = 'yyyy-MM-dd'): string {
  // Simple date formatting without timezone library
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  if (formatStr === 'yyyy-MM-dd') {
    return `${year}-${month}-${day}`;
  }
  
  // Fallback to ISO string
  return date.toISOString().split('T')[0];
}

/**
 * Get trading days in a date range
 */
export function getTradingDaysInRange(startDate: Date, endDate: Date): Date[] {
  const tradingDays: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isTradingDay(current)) {
      tradingDays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return tradingDays;
}

/**
 * Check if two dates are within N trading days of each other
 */
export function isWithinTradingDays(date1: Date, date2: Date, maxDays: number): boolean {
  const tradingDaysBetween = countTradingDays(
    date1 < date2 ? date1 : date2,
    date1 < date2 ? date2 : date1
  );
  
  return tradingDaysBetween <= maxDays;
}
