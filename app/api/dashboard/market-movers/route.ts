/**
 * API endpoint to fetch top market movers (gainers and losers)
 * Uses Massive.com/Polygon.io API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const BASE_URL = 'https://api.polygon.io';

interface TopMover {
  ticker: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!POLYGON_API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Get top gainers and losers in parallel
    const [gainersResponse, losersResponse] = await Promise.all([
      fetch(`${BASE_URL}/v2/snapshot/locale/us/markets/stocks/gainers?include_otc=false&apiKey=${POLYGON_API_KEY}`),
      fetch(`${BASE_URL}/v2/snapshot/locale/us/markets/stocks/losers?include_otc=false&apiKey=${POLYGON_API_KEY}`)
    ]);

    if (!gainersResponse.ok || !losersResponse.ok) {
      console.error('Polygon API error:', {
        gainers: gainersResponse.status,
        losers: losersResponse.status
      });
      return NextResponse.json(
        { error: 'Failed to fetch market movers' },
        { status: 500 }
      );
    }

    const gainersData = await gainersResponse.json();
    const losersData = await losersResponse.json();

    // Parse gainers
    const gainers: TopMover[] = (gainersData.tickers || [])
      .filter((ticker: any) => {
        const price = ticker.day?.c || ticker.prevDay?.c || 0;
        const volume = Math.max(ticker.day?.v || 0, ticker.prevDay?.v || 0);
        return price >= 5 && volume >= 1000000;
      })
      .slice(0, 10)
      .map((ticker: any) => ({
        ticker: ticker.ticker,
        name: ticker.name,
        price: ticker.day?.c || ticker.prevDay?.c || 0,
        change: ticker.todaysChange || 0,
        changePercent: ticker.todaysChangePerc || 0,
        volume: ticker.day?.v || 0,
        marketCap: ticker.market_cap
      }));

    // Parse losers
    const losers: TopMover[] = (losersData.tickers || [])
      .filter((ticker: any) => {
        const price = ticker.day?.c || ticker.prevDay?.c || 0;
        const volume = Math.max(ticker.day?.v || 0, ticker.prevDay?.v || 0);
        return price >= 5 && volume >= 1000000;
      })
      .slice(0, 10)
      .map((ticker: any) => ({
        ticker: ticker.ticker,
        name: ticker.name,
        price: ticker.day?.c || ticker.prevDay?.c || 0,
        change: ticker.todaysChange || 0,
        changePercent: ticker.todaysChangePerc || 0,
        volume: ticker.day?.v || 0,
        marketCap: ticker.market_cap
      }));

    console.log(`[Dashboard] Fetched ${gainers.length} gainers and ${losers.length} losers`);

    return NextResponse.json({
      success: true,
      gainers,
      losers,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Dashboard] Error fetching market movers:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

