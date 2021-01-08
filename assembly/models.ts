import { ContractPromiseBatch, storage, u128, PersistentUnorderedMap } from "near-sdk-as";

@nearBindgen
export class Pledge {
  id: string;
  amount: u128;
  refundAddress: string;

  constructor(id: string, amount: u128, refundAddress: string) {
    this.id = id;
    this.amount = amount;
    this.refundAddress = refundAddress;
  }
}

@nearBindgen
export class Campaign {
  id: string;
  campaigner: string;
  frozen: boolean;
  platformFee: u128; // 10000 = 100.00%
  funds: u128;

  constructor(id: string, campaigner: string, platformFee: u128) {
    this.id = id;
    this.campaigner = campaigner;
    this.frozen = false;
    this.platformFee = platformFee;
    this.funds = u128.from(0);
  }
}
