export interface Service {
  id: string;
  name: string;
  description: string;
  upstreamUrl: string;
  method: 'GET' | 'POST';
  priceUsdc: string;
  priceXlm?: string;
  asset: 'USDC' | 'XLM';
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tags: string[];
  enabled: boolean;
  createdAt: number;
  stats?: {
    totalRequests: number;
    paidRequests: number;
    totalRevenue: string;
  };
}

export interface PaymentChallenge {
  x402Version: 1;
  accepts: PaymentOption[];
  requestId: string;
  error: string;
}

export interface PaymentOption {
  scheme: 'exact';
  network: 'stellar';
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: {
    issuer: string;
    name: string;
  };
}

export interface PaymentProof {
  x402Version: 1;
  scheme: 'exact';
  network: 'stellar';
  payload: {
    txHash: string;
    from: string;
    amount: string;
  };
}

export interface PaymentRecord {
  txHash: string;
  serviceId: string;
  requestId: string;
  fromAddress: string;
  amountRaw: string;
  asset: string;
  createdAt: number;
}

export interface RegisterServiceInput {
  id: string;
  name: string;
  description?: string;
  upstreamUrl: string;
  method?: 'GET' | 'POST';
  priceUsdc: string;
  priceXlm?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tags?: string[];
}
