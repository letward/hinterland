export interface NeocromProfile {
  handle: string;
  name: string;
}

export interface NeocromConnection {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  verificationUrlComplete?: string;
  expiresIn: number;
  interval: number;
}

export function createNeocromIdClient(): {
  connect(): Promise<NeocromConnection>;
  poll(deviceCode: string): Promise<{ pending: true } | { accessToken: string; expiresIn: number; profile: NeocromProfile }>;
  profile(token: string): Promise<NeocromProfile>;
  pulseProject(token: string): Promise<{ project: string | null; endpoint: string | null; dashboard: string }>;
  disconnect(token: string): Promise<{ ok: true }>;
};
