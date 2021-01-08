import { Context, ContractPromiseBatch, env, storage, u128, PersistentUnorderedMap } from "near-sdk-as";

import { Pledge, Campaign } from './models';

const campaigns = new PersistentUnorderedMap<string, Campaign>("c");

const managerAddress = 'afb93471d33aecd7f54642131a4f2ca8e40befd13e2eecd78f5f91be7718c944';
const fundsAddress = '97b5c9de96c04194cf1a4abb6ff506f49ade30a8ebda06c4f85400fcbd0beba9';

function onlyManager(): void {
  // Only allow managerAddress to call
  assert(Context.sender == managerAddress, "Only callable by " + managerAddress);
}

export function listCampaigns(): Array<string> {
  // Get list of campaign IDs
  return campaigns.keys();
}

export function getCampaign(campaignID: string): Campaign {
  // Get campaign (throws if doesn't exist)
  return campaigns.getSome(campaignID);
}

export function createCampaign(id: string, campaigner: string, platformFee: u128): void {
  // Only allow manager address to call this function
  onlyManager();

  // Platform Fee must be between lower than 100.00%
  assert(platformFee <= u128.from(10000), "Platform fee is over 100.00%");

  // Don't allow overwriting existing campaign
  assert(campaigns.contains(id) == false, "Campaign already exists");

  // Campaigner should be a valid account ID
  assert(env.isValidAccountID(campaigner), "Campaigner should be a valid account");

  // Create new campaign
  const campaign = new Campaign(id, campaigner, platformFee);

  // Save campaign
  campaigns.set(id, campaign);
}

export function deleteCampaign(campaignID: string): void {
  // Only allow manager address to call this function
  onlyManager();

  // Get campaign (throws if doesn't exist)
  const campaign = campaigns.getSome(campaignID);

  // Campaign should be empty
  assert(campaign.funds == u128.from(0), "Can't delete a campaign that still hold funds");

  // Delete campaign
  campaigns.delete(campaignID);
}

export function listPledges(campaignID: string): Array<string> {
  // Campaign should exist
  assert(campaigns.contains(campaignID), "Campaign doesn't exist");

  // Return pledges
  const pledgesMap = new PersistentUnorderedMap<string, Pledge>(campaignID);
  return pledgesMap.keys();
}

export function getPledge(campaignID: string, pledgeID: string): Pledge {
  // Campaign should exist
  assert(campaigns.contains(campaignID), "Campaign doesn't exist");

  // Get pledge (throws if doesn't exist)
  const pledgesMap = new PersistentUnorderedMap<string, Pledge>(campaignID);
  return pledgesMap.getSome(pledgeID);
}

export function createPledge(campaignID: string, pledgeID: string, amount: u128, refundAddress: string): void {
  // Pledge must be more than 0
  assert(amount > u128.from(0));

  // Check that the correct amount of tokens were sent
  assert(Context.attachedDeposit == amount, "Attached deposit doesn't match pledge amount");

  // Get Campaign
  const campaign = campaigns.getSome(campaignID);

  // Campaign can't be frozen
  assert(campaign.frozen == false, "Can't pledge to a frozen campaign");

  // Pledge with this ID can't already be created
  const pledgesMap = new PersistentUnorderedMap<string, Pledge>(campaignID);
  assert(pledgesMap.contains(pledgeID) == false, "Pledge with this ID already exists");

  // Create new pledge
  const pledge = new Pledge(pledgeID, amount, refundAddress);

  // Add funds to campaign
  campaign.funds = campaign.funds + amount;

  // Save pledge
  pledgesMap.set(pledgeID, pledge);

  // Save Campaign
  campaigns.set(campaignID, campaign);
}

export function refundPledges(campaignID: string, pledgeIDs: Array<string>): void {
  // Only allow manager address to call this function
  onlyManager();

  // Get campaign (throws if doesn't exist)
  const campaign = campaigns.getSome(campaignID);

  // Get pledge map
  const pledgesMap = new PersistentUnorderedMap<string, Pledge>(campaignID);

  // Loop through pledges to refund
  for (let i = 0, k = pledgeIDs.length; i < k; ++i) {
    // Get pledge (throws if doesn't exist)
    const pledge = pledgesMap.getSome(pledgeIDs[i]);
    
    // Transfer funds to pledger
    ContractPromiseBatch.create(pledge.refundAddress).transfer(pledge.amount);

    // Subtract pledge amount from campaign
    campaign.funds = campaign.funds - pledge.amount;

    // Delete pledge
    pledgesMap.delete(pledgeIDs[i]);
  }

  // Save campaign
  campaigns.set(campaignID, campaign);
}

export function payoutCampaign(campaignID: string): void {
  // Only allow manager address to call this function
  onlyManager();

  // Get campaign (throws if doesn't exist)
  const campaign = campaigns.getSome(campaignID);

  // Don't payout if the amount raised is 0
  assert(campaign.funds > u128.from(0));

  // Calculate payout amounds
  const platformPayout = campaign.funds * campaign.platformFee / u128.from(10000);
  const campaignerPayout = campaign.funds - campaign.platformFee;

  // Transfer funds
  ContractPromiseBatch.create(campaign.campaigner).transfer(campaignerPayout);

  // Add platform payout to platform funds
  storage.set<u128>('platformFunds', storage.getSome<u128>('platformFunds') + platformPayout);

  // Clear all pledges
  const pledgesMap = new PersistentUnorderedMap<string, Pledge>(campaignID);
  pledgesMap.clear();

  // Set campaign funds to 0
  campaign.funds = u128.from(0);

  // Save campaign
  campaigns.set(campaignID, campaign);
}

export function freezeCampaign(campaignID: string): void {
  // Only allow manager address to call this function
  onlyManager();

  // Get campaign (throws if doesn't exist)
  const campaign = campaigns.getSome(campaignID);

  // Set campaign to frozen
  campaign.frozen = true;

  // Save campaign
  campaigns.set(campaignID, campaign);
}

export function unfreezeCampaign(campaignID: string): void {
  // Only allow manager address to call this function
  onlyManager();

  // Get campaign (throws if doesn't exist)
  const campaign = campaigns.getSome(campaignID);

  // Set campaign unfrozen
  campaign.frozen = false;

  // Save campaign
  campaigns.set(campaignID, campaign);
}

export function getPlatformFunds(): u128 {
  // Return platformFunds
  return storage.getSome<u128>('platformFunds');
}

export function addPlatformFunds(): void {
  // Add platformFunds
  storage.set<u128>('platformFunds', storage.getSome<u128>('platformFunds') + Context.attachedDeposit);
}

export function removePlatformFunds(amount: u128): void {
  // Only allow manager address to call this function
  onlyManager();

  // Get platformFunds
  const platformFunds = storage.getSome<u128>('platformFunds');
  
  // Don't allow withdrawing of more than platform funds
  assert(amount <= platformFunds, "Can't withdraw more than platformFunds amount");

  // Transfer funds
  ContractPromiseBatch.create(fundsAddress).transfer(amount);
}

export function getManager(): string {
  // Return manager address
  return managerAddress;
}

export function initialize(): void {
  // Will return 0 if no value is present
  const platformFunds = storage.get<u128>('platformFunds', u128.from(0))!;

  // Set back to storage
  storage.set<u128>('platformFunds', platformFunds);
}
