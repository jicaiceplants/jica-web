export type Role = "Owner" | "Staff" | "Driver" | "Security";

export interface UserAccount {
  id: string;
  name: string;
  username?: string;
  password?: string;
  email: string;
  role: Role;
  phone?: string;
  assignedTruckId?: string;
  photoUrl?: string;
  active: boolean;
  activeSessionToken?: string | null;
  lastActiveAt?: string | null;
  createdAt: string;
  lastLogin?: string;
}

export interface IceProduct {
  id: string;
  name: string;
  sackSize: string; // "Small" | "Medium" | "Large" (or legacy sack label)
  category?: string; // Kept optional for legacy DB row compatibility
  price: number; // in PHP (>= 0 allowed)
  inStock: number;
  imageUrl?: string;
}

export interface DeliveryLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  zone: "City Proper" | "Lapasan/Gusa Corridor" | "Uptown CDO" | "Market District";
  imageUrl?: string;
  customersCount?: number;
}

export interface StoreCustomer {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  stallNumber?: string;
  contactPerson?: string;
  phone?: string;
  defaultIceType: string;
  defaultSackSize: string;
  defaultQty: number;
  defaultPaymentType: "Cash" | "Charge Invoice";
  isInstitutional: boolean;
}

export interface LoadSlipItem {
  id: string;
  customerId: string;
  storeName: string;
  locationId: string;
  locationName: string;
  iceProductId: string;
  iceType: string;
  sackSize: string;
  plannedQty: number;
  deliveredQty: number;
  returnedQty?: number;
  unitPrice: number;
  totalPrice: number;
  paymentType: "Cash" | "Charge Invoice";
  status: "Pending" | "In Transit" | "Completed" | "Partial" | "Cancelled";
  partialReason?: string;
  deliveredAt?: string;
}

export type LoadSlipStatus =
  | "DISPATCHED"
  | "ACTIVE"
  | "IN_TRANSIT"
  | "DELIVERY_FINISHED"
  | "AWAITING_REMIT"
  | "REMITTED"
  | "COMPLETED"
  | "CANCELLED"
  | "Pending"
  | "In-Transit"
  | "Completed"
  | "Completed / Pending Remittance"
  | "Reconciled"
  | "Draft"
  | "Active";

export interface LoadSlip {
  id: string; // DB UUID when synced or slip number
  slipNumber?: string; // e.g. "LS-20261125-TRK01-A1B2"
  idempotencyKey: string;
  date: string; // YYYY-MM-DD Asia/Manila
  time: string; // HH:MM Asia/Manila
  truckId: string;
  truckPlate: string;
  inChargeId: string;
  inChargeName: string;
  driverId: string;
  driverName: string;
  status: LoadSlipStatus;
  items: LoadSlipItem[];
  totalLoadedSacks: number;
  totalDeliveredSacks: number;
  totalReturnedSacks: number;
  totalRevenue: number;
  totalCashRevenue: number;
  totalChargeRevenue: number;
  notes?: string;
  dispatchedAt?: string;
  deliveryFinishedAt?: string;
  remittedAt?: string;
  remittedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TruckVehicle {
  id: string;
  plateNumber: string;
  model: string;
  capacitySacks: number;
  sackCapacity?: number;
  currentDriverId?: string;
  imageUrl?: string;
  status: "Available" | "On Delivery" | "Maintenance" | "Alert";
}

export interface TruckCapacityInfo {
  truckId: string;
  plateNumber: string;
  model: string;
  sackCapacity: number;
  usedSacks: number;
  remainingCapacity: number;
  activeSlipsCount: number;
  isInTransit: boolean;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  loadSlipId: string;
  slipNumber?: string;
  truckId?: string;
  truckPlate: string;
  driverId?: string;
  driverName: string;
  inChargeName?: string;
  date: string; // YYYY-MM-DD Asia/Manila
  issuedAt?: string;
  customerName: string;
  locationName: string;
  iceType: string;
  sackSize: string;
  plannedQty?: number;
  deliveredQty: number;
  returnedQty?: number;
  unitPrice: number;
  totalAmount: number;
  paymentType: "Cash" | "Charge Invoice";
  status: "Pending Delivery" | "Cash Paid" | "Unpaid Charge" | "Settled Charge";
  settledAt?: string;
  settledBy?: string;
}

export interface LiveTruckTelemetry {
  truckId: string;
  truckPlate: string;
  driverId: string;
  driverName: string;
  status: "Delivering" | "In Transit" | "Idle" | "Alert";
  currentLocationName: string;
  currentStopStoreName: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
  loadedSacks: number;
  deliveredSacks: number;
  remainingSacks: number;
  totalStops: number;
  completedStops: number;
  lastPingTime: string;
  sosAlert?: {
    active: boolean;
    reason: string;
    timestamp: string;
    latitude: number;
    longitude: number;
    dispatchedRescue: boolean;
  };
}
