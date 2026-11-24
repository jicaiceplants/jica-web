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
  createdAt: string;
  lastLogin?: string;
}

export interface IceProduct {
  id: string;
  name: string;
  category: "Tube" | "Block" | "Crushed";
  sackSize: string; // "50kg Big Sack", "25kg Small Sack", "Standard Block"
  price: number; // in PHP
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
  isInstitutional: boolean; // true for hospitals, universities, major supermarkets
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
  unitPrice: number;
  totalPrice: number; // deliveredQty * unitPrice or plannedQty * unitPrice
  paymentType: "Cash" | "Charge Invoice";
  status: "Pending" | "In Transit" | "Completed" | "Partial" | "Cancelled";
  partialReason?: string;
  deliveredAt?: string;
}

export interface LoadSlip {
  id: string; // e.g. "LS-20261123-01"
  idempotencyKey: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  truckId: string;
  truckPlate: string;
  inChargeId: string;
  inChargeName: string;
  driverId: string;
  driverName: string;
  status: "Draft" | "Active" | "Completed" | "Completed / Pending Remittance" | "Reconciled";
  items: LoadSlipItem[];
  totalLoadedSacks: number;
  totalDeliveredSacks: number;
  totalReturnedSacks: number;
  totalRevenue: number;
  totalCashRevenue: number;
  totalChargeRevenue: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TruckVehicle {
  id: string;
  plateNumber: string;
  model: string;
  capacitySacks: number;
  currentDriverId?: string;
  imageUrl?: string;
  status: "Available" | "On Delivery" | "Maintenance" | "Alert";
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  loadSlipId: string;
  date: string; // YYYY-MM-DD Asia/Manila
  customerName: string;
  locationName: string;
  iceType: string;
  sackSize: string;
  deliveredQty: number;
  unitPrice: number;
  totalAmount: number;
  paymentType: "Cash" | "Charge Invoice";
  status: "Cash Paid" | "Unpaid Charge" | "Settled Charge";
  settledAt?: string;
  settledBy?: string;
  driverName: string;
  truckPlate: string;
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
