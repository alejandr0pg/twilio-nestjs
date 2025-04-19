export interface SiweSession {
  id: string;
  address: string;
  chainId: number;
  message: string;
  signature: string;
  expirationTime: Date;
}

export interface RequestWithSiweSession extends Request {
  siweSession: SiweSession;
}
