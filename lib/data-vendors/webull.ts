/**
 * Webull OpenAPI TypeScript Client
 *
 * Implements the Webull HMAC-SHA1 request signing algorithm and provides
 * typed methods for account, order, and token management endpoints.
 *
 * Signature algorithm reference:
 *   https://developer.webull.com/apis/docs/authentication/signature.md
 */

import crypto from 'crypto';

// ── Types ──

export interface WebullConfig {
  appKey: string;
  appSecret: string;
  host: string; // e.g. "api.webull.com" or "us-openapi-alb.uat.webullbroker.com"
  accessToken?: string;
}

export interface WebullAccount {
  account_id: string;
  account_type: string;
  currency?: string;
  status?: string;
  total_asset?: string;
}

export interface WebullOrderDetail {
  client_order_id: string;
  order_id: string;
  symbol: string;
  side: 'BUY' | 'SELL' | 'SHORT';
  status: 'PENDING' | 'SUBMITTED' | 'CANCELLED' | 'FILLED' | 'FAILED' | 'PARTIAL_FILLED';
  order_type: string;
  instrument_type: string;
  total_quantity: string;
  filled_quantity?: string;
  filled_price?: string;
  limit_price?: string;
  stop_price?: string;
  place_time?: string;
  place_time_at?: string | number;
  filled_time?: string;
  filled_time_at?: string | number;
  time_in_force: string;
  entrust_type: string;
  market?: string;
}

export interface WebullOrderGroup {
  client_order_id?: string;
  combo_order_id?: string;
  combo_type: string;
  orders: WebullOrderDetail[];
}

export interface WebullToken {
  token: string;
  expires: number;
  status: 'PENDING' | 'NORMAL' | 'INVALID' | 'EXPIRED';
}

// ── Signature generation ──

function generateSignature(
  path: string,
  queryParams: Record<string, string>,
  bodyString: string | null,
  appKey: string,
  appSecret: string,
  host: string,
  timestamp: string,
  nonce: string,
): string {
  const signingHeaders: Record<string, string> = {
    'x-app-key': appKey,
    'x-timestamp': timestamp,
    'x-signature-algorithm': 'HMAC-SHA1',
    'x-signature-version': '1.0',
    'x-signature-nonce': nonce,
    host,
  };

  // Merge query params + signing headers, sort by key
  const allParams: Record<string, string> = { ...queryParams, ...signingHeaders };
  const sortedKeys = Object.keys(allParams).sort();
  const str1 = sortedKeys.map(k => `${k}=${allParams[k]}`).join('&');

  let str3: string;
  if (bodyString) {
    const bodyMd5 = crypto.createHash('md5').update(bodyString, 'utf8').digest('hex').toUpperCase();
    str3 = `${path}&${str1}&${bodyMd5}`;
  } else {
    str3 = `${path}&${str1}`;
  }

  const encodedString = encodeURIComponent(str3);
  const signingKey = `${appSecret}&`;

  const hmac = crypto.createHmac('sha1', signingKey);
  hmac.update(encodedString, 'utf8');
  return hmac.digest('base64');
}

// ── Client ──

export class WebullClient {
  private config: WebullConfig;

  constructor(config: WebullConfig) {
    this.config = config;
  }

  get baseUrl() {
    return `https://${this.config.host}`;
  }

  setAccessToken(token: string) {
    this.config.accessToken = token;
  }

  private buildHeaders(
    path: string,
    queryParams: Record<string, string> = {},
    bodyString: string | null = null,
  ): Record<string, string> {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = crypto.randomUUID().replace(/-/g, '');

    const signature = generateSignature(
      path,
      queryParams,
      bodyString,
      this.config.appKey,
      this.config.appSecret,
      this.config.host,
      timestamp,
      nonce,
    );

    const headers: Record<string, string> = {
      'x-app-key': this.config.appKey,
      'x-timestamp': timestamp,
      'x-signature': signature,
      'x-signature-algorithm': 'HMAC-SHA1',
      'x-signature-version': '1.0',
      'x-signature-nonce': nonce,
      'x-version': 'v2',
    };

    if (this.config.accessToken) {
      headers['x-access-token'] = this.config.accessToken;
    }

    return headers;
  }

  async request<T = any>(
    method: 'GET' | 'POST',
    path: string,
    queryParams: Record<string, string> = {},
    body?: any,
  ): Promise<{ status: number; data: T; error?: string }> {
    const bodyString = body ? JSON.stringify(body, null, 0).replace(/\s+/g, '') : null;
    // Compact JSON for signing — must match what's sent in the body
    const compactBody = body ? JSON.stringify(body) : null;
    const headers = this.buildHeaders(path, queryParams, compactBody);

    let url = `${this.baseUrl}${path}`;
    if (method === 'GET' && Object.keys(queryParams).length > 0) {
      const qs = new URLSearchParams(queryParams).toString();
      url += `?${qs}`;
    }

    if (compactBody) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: compactBody || undefined,
        cache: 'no-store',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { status: res.status, data: null as any, error: `${res.status}: ${text.slice(0, 500)}` };
      }

      const data = await res.json();
      return { status: res.status, data };
    } catch (err: any) {
      return { status: 0, data: null as any, error: err.message };
    }
  }

  // ── Account endpoints ──

  async getAccountList(): Promise<{ status: number; data: WebullAccount[]; error?: string }> {
    return this.request<WebullAccount[]>('GET', '/openapi/account/list');
  }

  // ── Token endpoints (for 2FA) ──

  async createToken(): Promise<{ status: number; data: WebullToken; error?: string }> {
    return this.request<WebullToken>('POST', '/openapi/auth/token/create');
  }

  async checkToken(): Promise<{ status: number; data: WebullToken; error?: string }> {
    return this.request<WebullToken>('GET', '/openapi/auth/token/check');
  }

  // ── Order endpoints ──

  async getOrderHistory(
    accountId: string,
    startDate?: string,
    endDate?: string,
    pageSize: number = 100,
    lastClientOrderId?: string,
  ): Promise<{ status: number; data: WebullOrderGroup[]; error?: string }> {
    const params: Record<string, string> = { account_id: accountId, page_size: String(pageSize) };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (lastClientOrderId) params.last_client_order_id = lastClientOrderId;

    return this.request<WebullOrderGroup[]>('GET', '/openapi/trade/order/history', params);
  }

  /**
   * Fetch ALL filled orders by paginating through the full history.
   * Returns only orders with status === 'FILLED'.
   */
  async getAllFilledOrders(
    accountId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ orders: WebullOrderDetail[]; error?: string }> {
    const allFilled: WebullOrderDetail[] = [];
    let lastClientOrderId: string | undefined;
    let page = 0;
    const maxPages = 50; // safety limit

    while (page < maxPages) {
      const res = await this.getOrderHistory(accountId, startDate, endDate, 100, lastClientOrderId);
      if (res.error || !res.data) {
        return { orders: allFilled, error: res.error };
      }

      if (!Array.isArray(res.data) || res.data.length === 0) break;

      for (const group of res.data) {
        for (const order of group.orders) {
          if (order.status === 'FILLED') {
            allFilled.push(order);
          }
        }
        // Use the last client_order_id from this group for cursor-based pagination
        if (group.client_order_id) {
          lastClientOrderId = group.client_order_id;
        } else if (group.orders.length > 0) {
          lastClientOrderId = group.orders[group.orders.length - 1].client_order_id;
        }
      }

      if (res.data.length < 100) break; // last page
      page++;
    }

    return { orders: allFilled };
  }
}

// ── Factory ──

export function createWebullClient(overrides?: Partial<WebullConfig>): WebullClient {
  return new WebullClient({
    appKey: overrides?.appKey || process.env.WEBULL_API_KEY || '',
    appSecret: overrides?.appSecret || process.env.WEBULL_API_SECRET || '',
    host: overrides?.host || 'api.webull.com',
    accessToken: overrides?.accessToken,
  });
}
