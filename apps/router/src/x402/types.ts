export interface X402Challenge {
  x402Version: 1;
  accepts: X402PaymentOption[];
  requestId: string;
  error: string;
}

export interface X402PaymentOption {
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

export interface X402PaymentProof {
  x402Version: 1;
  scheme: 'exact';
  network: 'stellar';
  payload: {
    txHash: string;
    from: string;
    amount: string;
  };
}
