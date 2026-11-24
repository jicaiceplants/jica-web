import { 
  DeliveryLocation, 
  StoreCustomer, 
  IceProduct, 
  TruckVehicle, 
  UserAccount, 
  LoadSlip, 
  LiveTruckTelemetry,
  InvoiceRecord 
} from "./types";

// ==============================================================================
// OFFICIAL JICA ICE PLANT (#69 OLD ROAD GUSA, CDOC 9000)
// ==============================================================================
export const CDO_DEPOT = {
  name: "JICA ICEPLANT",
  address: "#69 Old Road Gusa, CDOC 9000",
  latitude: 8.4770172,
  longitude: 124.6798424,
  contact: "(088) 855-JICA / 0917-791-3706"
};

// ==============================================================================
// INITIAL DATA ARRAYS (EMPTY FOR CLEAN PRODUCTION MANUAL ENCODING)
// ==============================================================================
// Per Phase 2 directive: No fake products, trucks, hubs, or mock load slips.
// All business records will be manually created via the live UI and Supabase.

export const INITIAL_PRODUCTS: IceProduct[] = [];

export const INITIAL_TRUCKS: TruckVehicle[] = [];

export const INITIAL_LOCATIONS: DeliveryLocation[] = [];

export const INITIAL_CUSTOMERS: StoreCustomer[] = [];

export const HISTORICAL_LOAD_SLIPS: LoadSlip[] = [];

export const YESTERDAY_LOAD_SLIP: LoadSlip | null = null;

export const INITIAL_INVOICES: InvoiceRecord[] = [];

export const INITIAL_TELEMETRY: LiveTruckTelemetry[] = [];

// ==============================================================================
// MINIMAL BOOTSTRAP OWNER ACCOUNT ONLY (FIRST BOOT LOGIN)
// ==============================================================================
export const INITIAL_USERS: UserAccount[] = [
  {
    id: "USR-DINO-OWNER",
    name: "Dino Trocino",
    role: "Owner",
    username: "owner",
    password: "owner",
    email: "dino@jicaice.com",
    phone: "0917-111-2233",
    active: true,
    createdAt: new Date().toISOString()
  }
];

export const CURRENT_USER: UserAccount = INITIAL_USERS[0];
