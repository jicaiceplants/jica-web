import {
  Role,
  DeliveryLocation,
  StoreCustomer,
  IceProduct,
  TruckVehicle,
  TruckCapacityInfo,
  UserAccount,
  LoadSlip,
  LoadSlipItem,
  LiveTruckTelemetry,
  InvoiceRecord
} from "./types";
import { supabase } from "./supabaseClient";
import { getManilaDateString, getManilaTimeString, formatManilaDateTime } from "./dateUtils";
import { roundCurrency, multiplyCurrency, sumCurrency } from "./currencyUtils";
import { sanitizeStoredImageUrl, deleteStorageImage } from "./imageUpload";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://jica-backend-production.up.railway.app")
  .replace(/\/+$/, "")
  .trim();

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const STORAGE_KEYS = {
  LOCATIONS: "jica_locations",
  CUSTOMERS: "jica_customers",
  PRODUCTS: "jica_products",
  TRUCKS: "jica_trucks",
  USERS: "jica_users",
  LOAD_SLIPS: "jica_load_slips",
  TELEMETRY: "jica_telemetry",
  CURRENT_USER: "jica_current_user",
  INVOICES: "jica_invoices",
  RECONCILIATIONS: "jica_reconciliations",
  WEB_SESSION: "jica_web_session",
  AUTH_TOKEN: "jica_auth_token",
  SESSION_TOKEN: "jica_session_token"
};

function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving ${key} to storage:`, e);
  }
}

const isUUID = (val?: string | null): boolean =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()));

let _sessionRevokedCallback: ((reason?: string) => void) | null = null;

function mapDbSlipToWeb(s: any, usersById?: Map<string, UserAccount>, trucksById?: Map<string, TruckVehicle>): LoadSlip {
  const trk = trucksById?.get(s.truck_id);
  const drv = s.driver_id ? usersById?.get(s.driver_id) : undefined;
  const inc = s.in_charge_id ? usersById?.get(s.in_charge_id) : undefined;
  const items: LoadSlipItem[] = (s.load_slip_items || []).map((item: any) => ({
    id: item.id,
    customerId: item.customer_id || "",
    storeName: item.customer_name || "",
    locationId: item.hub_id || "",
    locationName: item.delivery_hubs?.name || item.hub_name || "",
    iceProductId: item.product_id || "",
    iceType: item.product_name || "",
    sackSize: item.sack_size || "Standard Sack",
    plannedQty: Number(item.planned_qty || 0),
    deliveredQty: Number(item.delivered_qty || 0),
    returnedQty: Number(item.returned_qty || 0),
    unitPrice: roundCurrency(item.unit_price),
    totalPrice: roundCurrency(item.total_amount),
    paymentType: item.payment_mode === "Charge" ? "Charge Invoice" : "Cash",
    status: (item.status as any) || (Number(item.delivered_qty || 0) >= Number(item.planned_qty || 0) && item.delivered_at ? "Completed" : "Pending"),
    partialReason: item.partial_reason || undefined,
    deliveredAt: item.delivered_at || undefined
  }));

  const cashRev = roundCurrency(s.total_cash_revenue);
  const chargeRev = roundCurrency(s.total_charge_revenue);

  return {
    id: s.id,
    slipNumber: s.slip_number || s.id,
    idempotencyKey: s.idempotency_key || s.id,
    date: s.date || getManilaDateString(s.created_at),
    time: s.departure_time ? String(s.departure_time).slice(0, 5) : "06:00",
    truckId: s.truck_id || "",
    truckPlate: s.truck_plate || s.trucks?.plate_number || trk?.plateNumber || s.truck_id || "",
    inChargeId: s.in_charge_id || "",
    inChargeName: s.in_charge_name || inc?.name || s.created_by || "",
    driverId: s.driver_id || "",
    driverName: s.driver_name || drv?.name || "Unassigned Driver",
    status: (s.status as any) || "DISPATCHED",
    items,
    totalLoadedSacks: Number(s.total_loaded_sacks || 0),
    totalDeliveredSacks: Number(s.total_delivered_sacks || 0),
    totalReturnedSacks: Number(s.total_returned_sacks || 0),
    totalRevenue: roundCurrency(cashRev + chargeRev),
    totalCashRevenue: cashRev,
    totalChargeRevenue: chargeRev,
    notes: s.notes || undefined,
    dispatchedAt: s.dispatched_at || s.created_at,
    deliveryFinishedAt: s.delivery_finished_at || undefined,
    remittedAt: s.remitted_at || undefined,
    remittedBy: s.remitted_by || undefined,
    createdAt: s.created_at || new Date().toISOString(),
    updatedAt: s.updated_at || s.created_at || new Date().toISOString()
  };
}

function mapDbInvoiceToWeb(inv: any): InvoiceRecord {
  const slipMeta = inv.load_slips || {};
  const rawStatus = String(inv.status || "Pending Delivery");
  let mappedStatus: InvoiceRecord["status"] = "Pending Delivery";
  if (rawStatus === "Cash Paid") mappedStatus = "Cash Paid";
  else if (rawStatus === "Unpaid Charge") mappedStatus = "Unpaid Charge";
  else if (rawStatus === "Settled" || rawStatus === "Settled Charge") mappedStatus = "Settled Charge";

  return {
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    loadSlipId: inv.load_slip_id || "",
    slipNumber: inv.slip_number || slipMeta.slip_number || "",
    truckId: inv.truck_id || slipMeta.truck_id || "",
    truckPlate: inv.truck_plate || slipMeta.truck_plate || inv.truck_id || slipMeta.truck_id || "",
    driverId: inv.driver_id || "",
    driverName: inv.driver_name || slipMeta.driver_name || "",
    inChargeName: inv.in_charge_name || slipMeta.in_charge_name || "",
    date: inv.issue_date || getManilaDateString(inv.created_at),
    issuedAt: inv.issued_at || inv.created_at,
    customerName: inv.customer_name || "",
    locationName: inv.hub_name || "",
    iceType: inv.product_name || "",
    sackSize: inv.sack_size || "Standard Sack",
    plannedQty: Number(inv.planned_qty ?? inv.delivered_qty ?? 0),
    deliveredQty: Number(inv.delivered_qty ?? 0),
    returnedQty: Number(inv.returned_qty ?? 0),
    unitPrice: roundCurrency(inv.unit_price),
    totalAmount: roundCurrency(inv.total_amount),
    paymentType: inv.payment_type === "Charge" ? "Charge Invoice" : "Cash",
    status: mappedStatus,
    settledAt: inv.settled_at ? formatManilaDateTime(inv.settled_at) : undefined,
    settledBy: inv.settled_by || undefined
  };
}

export class DataService {
  static setSessionRevokedHandler(cb: ((reason?: string) => void) | null) {
    _sessionRevokedCallback = cb;
  }

  static getSessionToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
      const direct = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      if (direct) return direct;
      const raw = localStorage.getItem(STORAGE_KEYS.WEB_SESSION);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.sessionToken || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  static getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (typeof window === "undefined") return headers;

    const sessionToken = this.getSessionToken();
    const user = this.getCurrentUser();
    const jwtToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

    if (sessionToken) headers["X-Session-Token"] = sessionToken;
    if (user?.id) headers["X-User-Id"] = user.id;
    if (jwtToken) headers["Authorization"] = `Bearer ${jwtToken}`;
    return headers;
  }

  static async authorizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const mergedHeaders = {
      ...this.getAuthHeaders(),
      ...(options.headers as Record<string, string> | undefined)
    };
    const res = await fetch(url, { ...options, headers: mergedHeaders });
    if (res.status === 401) {
      const clone = res.clone();
      const body = await clone.json().catch(() => ({}));
      const detail = String(body?.detail || "");
      if (detail.includes("SESSION_REVOKED") && _sessionRevokedCallback) {
        _sessionRevokedCallback("You have been logged out because this account was signed in on another device.");
      }
    }
    return res;
  }

  static clearSession(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEYS.WEB_SESSION);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
  }

  static getCurrentUser(): UserAccount | null {
    if (typeof window === "undefined") return null;
    try {
      const rawSession = localStorage.getItem(STORAGE_KEYS.WEB_SESSION);
      if (rawSession) {
        const session = JSON.parse(rawSession);
        if (session?.user) return session.user as UserAccount;
      }
      return getStorageItem<UserAccount | null>(STORAGE_KEYS.CURRENT_USER, null);
    } catch {
      return null;
    }
  }

  static setCurrentUser(user: UserAccount | null): void {
    if (typeof window === "undefined") return;
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      return;
    }
    setStorageItem(STORAGE_KEYS.CURRENT_USER, user);
  }

  static async validateActiveSession(): Promise<{ valid: boolean; reason?: string }> {
    const user = this.getCurrentUser();
    const sessionToken = this.getSessionToken();
    if (!user?.id || !sessionToken) {
      return { valid: false, reason: "Session expired." };
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/validate-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, session_token: sessionToken })
      });
      if (res.status === 401) {
        const err = await res.json().catch(() => ({}));
        return {
          valid: false,
          reason: err.detail?.replace("SESSION_REVOKED: ", "") || "You have been logged out because this account was signed in on another device."
        };
      }
      if (res.ok) return { valid: true };
    } catch {
      // Fallback check via Supabase directly if backend cold/unreachable
      try {
        const { data, error } = await supabase
          .from("user_accounts")
          .select("active_session_token, is_active, deleted_at")
          .eq("id", user.id)
          .limit(1)
          .single();
        if (!error && data) {
          if (!data.is_active || data.deleted_at) {
            return { valid: false, reason: "Your account has been deactivated." };
          }
          if (data.active_session_token !== sessionToken) {
            return {
              valid: false,
              reason: "You have been logged out because this account was signed in on another device."
            };
          }
        }
      } catch {
        // Offline transient check: don't spuriously kick user out on network drop
      }
    }
    return { valid: true };
  }

  static async logoutUser(): Promise<void> {
    const user = this.getCurrentUser();
    const sessionToken = this.getSessionToken();
    if (user?.id) {
      try {
        await fetch(`${BACKEND_URL}/api/v1/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, session_token: sessionToken })
        });
      } catch {
        // Ignore network errors on explicit logout
      }
    }
    this.clearSession();
  }

  // --- SUPABASE LIVE SYNCHRONIZATION (ZERO MOCK DATA) ---
  static async fetchLiveFromSupabase(): Promise<{ success: boolean; error?: string }> {
    try {
      const [prodsRes, trucksRes, hubsRes, custsRes, usersRes, invRes, slipsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, category, description, sack_size, sack_weight_kg, standard_price, image_url, created_at")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("created_at", { ascending: true }),
        supabase
          .from("trucks")
          .select("id, plate_number, model, sack_capacity, max_sack_capacity, image_url")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("id", { ascending: true }),
        supabase
          .from("delivery_hubs")
          .select("id, name, address, latitude, longitude, zone, photo_url")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name", { ascending: true }),
        supabase
          .from("customers")
          .select("id, name, hub_id, contact_person, contact_phone, default_payment, delivery_hubs(name)")
          .eq("is_active", true)
          .is("deleted_at", null),
        supabase
          .from("user_accounts")
          .select("id, full_name, role, username, email, phone_number, assigned_truck_id, photo_url, is_active, created_at")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("created_at", { ascending: true }),
        supabase
          .from("invoices")
          .select("id, invoice_number, load_slip_id, slip_number, truck_id, truck_plate, driver_id, driver_name, in_charge_name, customer_name, hub_name, product_name, sack_size, planned_qty, delivered_qty, returned_qty, unit_price, total_amount, payment_type, status, issue_date, issued_at, settled_at, settled_by, created_at, load_slips(slip_number, truck_id, truck_plate, driver_name, in_charge_name, status)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("load_slips")
          .select("id, slip_number, idempotency_key, date, departure_time, truck_id, truck_plate, in_charge_id, in_charge_name, driver_id, driver_name, status, total_loaded_sacks, total_delivered_sacks, total_returned_sacks, total_cash_revenue, total_charge_revenue, notes, created_by, dispatched_at, delivery_finished_at, remitted_at, remitted_by, created_at, updated_at, trucks(plate_number, model), load_slip_items(id, customer_id, customer_name, hub_id, hub_name, product_id, product_name, sack_size, planned_qty, delivered_qty, returned_qty, unit_price, total_amount, payment_mode, status, partial_reason, delivered_at, delivery_hubs(name))")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
      ]);

      let mappedProducts: IceProduct[] = [];
      if (!prodsRes.error && prodsRes.data) {
        mappedProducts = prodsRes.data.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category || p.description || "Ice",
          sackSize: p.sack_size || `${p.sack_weight_kg || 50}kg`,
          price: roundCurrency(p.standard_price),
          inStock: 0,
          imageUrl: sanitizeStoredImageUrl(p.image_url)
        }));
        setStorageItem(STORAGE_KEYS.PRODUCTS, mappedProducts);
      }

      let mappedTrucks: TruckVehicle[] = [];
      const trucksMap = new Map<string, TruckVehicle>();
      if (!trucksRes.error && trucksRes.data) {
        mappedTrucks = trucksRes.data.map(t => {
          const cap = Number(t.sack_capacity ?? t.max_sack_capacity ?? 120);
          const item: TruckVehicle = {
            id: t.id,
            plateNumber: t.plate_number,
            model: t.model,
            capacitySacks: cap,
            sackCapacity: cap,
            imageUrl: sanitizeStoredImageUrl(t.image_url),
            status: "Available"
          };
          trucksMap.set(item.id, item);
          return item;
        });
        setStorageItem(STORAGE_KEYS.TRUCKS, mappedTrucks);
      }

      if (!hubsRes.error && hubsRes.data) {
        const mappedLocations: DeliveryLocation[] = hubsRes.data.map(h => ({
          id: h.id,
          name: h.name,
          address: h.address,
          latitude: Number(h.latitude),
          longitude: Number(h.longitude),
          zone: (h.zone as any) || "City Proper",
          imageUrl: sanitizeStoredImageUrl(h.photo_url)
        }));
        setStorageItem(STORAGE_KEYS.LOCATIONS, mappedLocations);
      }

      if (!custsRes.error && custsRes.data) {
        const mappedCustomers: StoreCustomer[] = custsRes.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          locationId: c.hub_id,
          locationName: (Array.isArray(c.delivery_hubs) ? c.delivery_hubs[0]?.name : c.delivery_hubs?.name) || "",
          contactPerson: c.contact_person || undefined,
          phone: c.contact_phone || undefined,
          defaultIceType: mappedProducts[0]?.name || "",
          defaultSackSize: mappedProducts[0]?.sackSize || "",
          defaultQty: 1,
          defaultPaymentType: c.default_payment === "Charge" ? "Charge Invoice" : "Cash",
          isInstitutional: false
        }));
        setStorageItem(STORAGE_KEYS.CUSTOMERS, mappedCustomers);
      }

      const usersMap = new Map<string, UserAccount>();
      if (!usersRes.error && usersRes.data) {
        const mappedUsers: UserAccount[] = usersRes.data.map(u => {
          const acc: UserAccount = {
            id: u.id,
            name: u.full_name,
            username: u.username || undefined,
            email: u.email || "",
            role: u.role as Role,
            phone: u.phone_number || undefined,
            assignedTruckId: u.assigned_truck_id || undefined,
            photoUrl: u.photo_url || undefined,
            active: u.is_active ?? true,
            createdAt: u.created_at || new Date().toISOString()
          };
          usersMap.set(acc.id, acc);
          return acc;
        });
        setStorageItem(STORAGE_KEYS.USERS, mappedUsers);
      }

      if (!invRes.error && invRes.data) {
        const mappedInvoices = invRes.data.map(mapDbInvoiceToWeb);
        setStorageItem(STORAGE_KEYS.INVOICES, mappedInvoices);
      }

      if (!slipsRes.error && slipsRes.data) {
        const mappedSlips = slipsRes.data.map(s => mapDbSlipToWeb(s, usersMap, trucksMap));
        setStorageItem(STORAGE_KEYS.LOAD_SLIPS, mappedSlips);
      }

      return { success: true };
    } catch (e: any) {
      console.warn("Supabase fetch notice:", e?.message);
      return { success: false, error: e?.message };
    }
  }

  // --- TRASH & RECOVERY ---
  static async fetchTrashItems(): Promise<any[]> {
    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/trash/items`);
      if (res.ok) {
        const json = await res.json();
        return json.items || [];
      }
    } catch {
      // Fallback below
    }

    const items: any[] = [];
    const tables = ["load_slips", "invoices", "products", "trucks", "delivery_hubs", "customers", "user_accounts"];
    const now = Date.now();
    for (const table of tables) {
      try {
        const { data } = await supabase.from(table).select("*").not("deleted_at", "is", null);
        if (data) {
          for (const row of data) {
            const delAt = row.deleted_at ? new Date(row.deleted_at).getTime() : now;
            const daysLeft = Math.max(0, 30 - Math.floor((now - delAt) / (1000 * 60 * 60 * 24)));
            const displayName = row.name || row.full_name || row.slip_number || row.invoice_number || row.plate_number || row.id || "Item";
            items.push({
              id: row.id,
              entity_type: table,
              display_name: displayName,
              deleted_at: row.deleted_at,
              deleted_by: row.deleted_by || "Staff",
              days_left: daysLeft
            });
          }
        }
      } catch {
        // ignore missing columns
      }
    }
    return items;
  }

  static async softDeleteItem(entityType: string, id: string, deletedBy?: string): Promise<{ success: boolean; message: string }> {
    const staff = deletedBy || this.getCurrentUser()?.name || "Staff";
    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/trash/soft-delete`, {
        method: "POST",
        body: JSON.stringify({ entity_type: entityType, entity_id: id, deleted_by: staff })
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, message: json.message || `${entityType} moved to Trash.` };
      }
      if (res.status === 409) {
        return { success: false, message: json.detail || "Item is currently in active use." };
      }
    } catch {
      // fallback
    }

    const now = new Date().toISOString();
    const payload: any = { deleted_at: now, deleted_by: staff };
    if (["trucks", "products", "delivery_hubs", "customers", "user_accounts"].includes(entityType)) {
      payload.is_active = false;
    }
    const { error } = await supabase.from(entityType).update(payload).eq("id", id);
    if (error) return { success: false, message: error.message };
    return { success: true, message: `${entityType} moved to Trash.` };
  }

  static async restoreTrashItem(entityType: string, id: string, restoredBy?: string): Promise<{ success: boolean; message: string }> {
    const staff = restoredBy || this.getCurrentUser()?.name || "Staff";
    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/trash/restore`, {
        method: "POST",
        body: JSON.stringify({ entity_type: entityType, entity_id: id, restored_by: staff })
      });
      if (res.ok) {
        await this.fetchLiveFromSupabase();
        return { success: true, message: `${entityType} item restored.` };
      }
    } catch {
      // fallback
    }

    const payload: any = { deleted_at: null, deleted_by: null };
    if (["trucks", "products", "delivery_hubs", "customers", "user_accounts"].includes(entityType)) {
      payload.is_active = true;
    }
    const { error } = await supabase.from(entityType).update(payload).eq("id", id);
    if (error) return { success: false, message: error.message };
    await this.fetchLiveFromSupabase();
    return { success: true, message: `${entityType} item restored.` };
  }

  static async deleteForeverTrashItem(entityType: string, id: string, adminUserId: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/trash/delete-forever`, {
        method: "POST",
        body: JSON.stringify({ entity_type: entityType, entity_id: id, admin_user_id: adminUserId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, message: "Record permanently purged from database." };
      }
      return { success: false, message: data.detail || "Failed to permanently delete item." };
    } catch (err: any) {
      return { success: false, message: err.message || "Network error reaching backend." };
    }
  }

  static async deleteInvoice(id: string, deletedBy?: string): Promise<{ success: boolean; message: string }> {
    const res = await this.softDeleteItem("invoices", id, deletedBy);
    if (res.success) {
      const invoices = this.getInvoices().filter(i => i.id !== id);
      setStorageItem(STORAGE_KEYS.INVOICES, invoices);
    }
    return res;
  }

  static async deleteLoadSlip(id: string, deletedBy?: string): Promise<{ success: boolean; message: string }> {
    const res = await this.softDeleteItem("load_slips", id, deletedBy);
    if (res.success) {
      const slips = this.getHistoricalLoadSlips().filter(s => s.id !== id);
      setStorageItem(STORAGE_KEYS.LOAD_SLIPS, slips);
    }
    return res;
  }

  // --- DELIVERY HUBS ---
  static getLocations(): DeliveryLocation[] {
    const locs = getStorageItem<DeliveryLocation[]>(STORAGE_KEYS.LOCATIONS, []);
    return Array.isArray(locs) ? locs : [];
  }

  static async addLocation(newLoc: Omit<DeliveryLocation, "id" | "customersCount">): Promise<{ success: boolean; location?: DeliveryLocation; message?: string }> {
    const id = generateUUID();
    const safePhoto = sanitizeStoredImageUrl(newLoc.imageUrl) || null;
    const location: DeliveryLocation = {
      id,
      name: newLoc.name,
      address: newLoc.address,
      latitude: newLoc.latitude,
      longitude: newLoc.longitude,
      zone: newLoc.zone,
      imageUrl: safePhoto || undefined,
      customersCount: 0
    };

    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/hubs`, {
        method: "POST",
        body: JSON.stringify({
          id,
          name: newLoc.name,
          address: newLoc.address,
          latitude: newLoc.latitude,
          longitude: newLoc.longitude,
          zone: newLoc.zone,
          photo_url: safePhoto
        })
      });
      if (res.ok) {
        const updated = [location, ...this.getLocations()];
        setStorageItem(STORAGE_KEYS.LOCATIONS, updated);
        return { success: true, location };
      }
    } catch {
      // fallback direct Supabase
    }

    const { error } = await supabase.from("delivery_hubs").insert({
      id,
      code: `HUB-${id.substring(0, 8).toUpperCase()}`,
      name: newLoc.name,
      address: newLoc.address,
      latitude: newLoc.latitude,
      longitude: newLoc.longitude,
      zone: newLoc.zone,
      photo_url: safePhoto,
      is_active: true
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const updated = [location, ...this.getLocations()];
    setStorageItem(STORAGE_KEYS.LOCATIONS, updated);
    return { success: true, location };
  }

  static async updateLocation(id: string, updates: Partial<DeliveryLocation>): Promise<{ success: boolean; location?: DeliveryLocation | null; message?: string }> {
    const existing = this.getLocations().find(l => l.id === id);
    const oldPhotoUrl = existing?.imageUrl;
    const safePhoto = updates.imageUrl !== undefined ? sanitizeStoredImageUrl(updates.imageUrl) || null : undefined;

    const dbPayload: any = {};
    if (updates.name !== undefined) dbPayload.name = updates.name.trim();
    if (updates.address !== undefined) dbPayload.address = updates.address.trim();
    if (updates.latitude !== undefined) dbPayload.latitude = updates.latitude;
    if (updates.longitude !== undefined) dbPayload.longitude = updates.longitude;
    if (updates.zone !== undefined) dbPayload.zone = updates.zone;
    if (safePhoto !== undefined) dbPayload.photo_url = safePhoto;

    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/hubs/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(dbPayload)
      });
      if (!res.ok) {
        const { error } = await supabase.from("delivery_hubs").update(dbPayload).eq("id", id);
        if (error) return { success: false, message: error.message };
      }
    } catch {
      const { error } = await supabase.from("delivery_hubs").update(dbPayload).eq("id", id);
      if (error) return { success: false, message: error.message };
    }

    if (safePhoto !== undefined && oldPhotoUrl && oldPhotoUrl !== safePhoto) {
      await deleteStorageImage(oldPhotoUrl);
    }

    const list = this.getLocations();
    const index = list.findIndex(l => l.id === id);
    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...updates,
        ...(safePhoto !== undefined ? { imageUrl: safePhoto || undefined } : {})
      };
      setStorageItem(STORAGE_KEYS.LOCATIONS, list);
      return { success: true, location: list[index] };
    }
    return { success: true, location: null };
  }

  static async deleteLocation(id: string, deletedBy?: string): Promise<{ success: boolean; message: string }> {
    const existing = this.getLocations().find(l => l.id === id);
    const res = await this.softDeleteItem("delivery_hubs", id, deletedBy);
    if (res.success) {
      if (existing?.imageUrl) {
        await deleteStorageImage(existing.imageUrl);
        await supabase.from("delivery_hubs").update({ photo_url: null }).eq("id", id);
      }
      const locations = this.getLocations().filter(l => l.id !== id);
      setStorageItem(STORAGE_KEYS.LOCATIONS, locations);
    }
    return res;
  }

  // --- CUSTOMERS ---
  static getCustomers(): StoreCustomer[] {
    const custs = getStorageItem<StoreCustomer[]>(STORAGE_KEYS.CUSTOMERS, []);
    return Array.isArray(custs) ? custs : [];
  }

  static getCustomersByLocation(locationId: string): StoreCustomer[] {
    return this.getCustomers().filter(c => c && c.locationId === locationId);
  }

  // --- ICE PRODUCTS (ALLOW >= 0 PRICE, SACK SIZE) ---
  static getProducts(): IceProduct[] {
    const prods = getStorageItem<IceProduct[]>(STORAGE_KEYS.PRODUCTS, []);
    return Array.isArray(prods) ? prods : [];
  }

  static async addProduct(prod: Omit<IceProduct, "id">): Promise<{ success: boolean; product?: IceProduct; message?: string }> {
    const safePrice = roundCurrency(Math.max(0, Number(prod.price) || 0));
    const safeImageUrl = sanitizeStoredImageUrl(prod.imageUrl) || null;
    const sackSize = (prod.sackSize || "Medium").trim();
    const compatCategory = (prod.category || sackSize || "Medium").trim();
    const id = generateUUID();
    const newProduct: IceProduct = {
      id,
      name: prod.name,
      sackSize,
      category: compatCategory,
      price: safePrice,
      inStock: 0,
      imageUrl: safeImageUrl || undefined
    };

    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/products`, {
        method: "POST",
        body: JSON.stringify({
          id,
          name: prod.name,
          category: compatCategory,
          sack_size: sackSize,
          standard_price: safePrice,
          image_url: safeImageUrl
        })
      });
      if (res.ok) {
        const updated = [...this.getProducts(), newProduct];
        setStorageItem(STORAGE_KEYS.PRODUCTS, updated);
        return { success: true, product: newProduct };
      }
    } catch {
      // Fallback direct Supabase
    }

    const { error } = await supabase.from("products").insert({
      id,
      code: `PROD-${id.substring(0, 8).toUpperCase()}`,
      name: prod.name,
      description: sackSize,
      category: compatCategory,
      sack_size: sackSize,
      sack_weight_kg: 50.0,
      standard_price: safePrice,
      image_url: safeImageUrl,
      is_active: true
    });
    if (error) return { success: false, message: error.message };

    setStorageItem(STORAGE_KEYS.PRODUCTS, [...this.getProducts(), newProduct]);
    return { success: true, product: newProduct };
  }

  static async updateProductPrice(id: string, newPrice: number): Promise<boolean> {
    const safePrice = roundCurrency(Math.max(0, Number(newPrice) || 0));
    const products = this.getProducts().map(p => (p.id === id ? { ...p, price: safePrice } : p));
    setStorageItem(STORAGE_KEYS.PRODUCTS, products);

    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/products/${id}`, {
        method: "PUT",
        body: JSON.stringify({ standard_price: safePrice })
      });
      if (res.ok) return true;
    } catch {
      // fallback
    }

    const { error } = await supabase.from("products").update({ standard_price: safePrice }).eq("id", id);
    return !error;
  }

  static async updateProduct(id: string, updates: Partial<IceProduct>): Promise<IceProduct | null> {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === id);
    const oldImageUrl = index >= 0 ? products[index].imageUrl : undefined;
    const normalizedPrice = updates.price !== undefined ? roundCurrency(Math.max(0, updates.price)) : undefined;
    const safeImageUrl =
      updates.imageUrl !== undefined ? sanitizeStoredImageUrl(updates.imageUrl) || null : undefined;

    if (index >= 0) {
      products[index] = {
        ...products[index],
        ...updates,
        ...(normalizedPrice !== undefined ? { price: normalizedPrice } : {}),
        ...(safeImageUrl !== undefined ? { imageUrl: safeImageUrl || undefined } : {})
      };
      setStorageItem(STORAGE_KEYS.PRODUCTS, products);
    }

    const dbPayload: any = {};
    if (normalizedPrice !== undefined) dbPayload.standard_price = normalizedPrice;
    if (updates.name !== undefined) dbPayload.name = updates.name.trim();
    if (updates.sackSize !== undefined) {
      dbPayload.sack_size = updates.sackSize.trim();
      dbPayload.description = updates.sackSize.trim();
      dbPayload.category = updates.category || updates.sackSize.trim();
    } else if (updates.category !== undefined) {
      dbPayload.category = updates.category;
      dbPayload.description = updates.category;
    }
    if (safeImageUrl !== undefined) dbPayload.image_url = safeImageUrl;

    if (Object.keys(dbPayload).length > 0) {
      try {
        const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/products/${id}`, {
          method: "PUT",
          body: JSON.stringify(dbPayload)
        });
        if (!res.ok) {
          await supabase.from("products").update(dbPayload).eq("id", id);
        }
      } catch {
        await supabase.from("products").update(dbPayload).eq("id", id);
      }
    }

    if (safeImageUrl !== undefined && oldImageUrl && oldImageUrl !== safeImageUrl) {
      await deleteStorageImage(oldImageUrl);
    }

    return index >= 0 ? products[index] : null;
  }

  static async deleteProduct(id: string, deletedBy?: string): Promise<{ success: boolean; message: string }> {
    const existing = this.getProducts().find(p => p.id === id);
    const res = await this.softDeleteItem("products", id, deletedBy);
    if (res.success) {
      if (existing?.imageUrl) {
        await deleteStorageImage(existing.imageUrl);
        await supabase.from("products").update({ image_url: null }).eq("id", id);
      }
      const products = this.getProducts().filter(p => p.id !== id);
      setStorageItem(STORAGE_KEYS.PRODUCTS, products);
    }
    return res;
  }

  // --- TRUCKS & CAPACITY ---
  static getTrucks(): TruckVehicle[] {
    const trks = getStorageItem<TruckVehicle[]>(STORAGE_KEYS.TRUCKS, []);
    return Array.isArray(trks) ? trks : [];
  }

  static async fetchTrucksCapacity(): Promise<TruckCapacityInfo[]> {
    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/trucks/capacity`);
      if (res.ok) {
        const json = await res.json();
        return (json.data || []).map((t: any) => ({
          truckId: t.truck_id,
          plateNumber: t.plate_number,
          model: t.model,
          sackCapacity: Number(t.sack_capacity || 120),
          usedSacks: Number(t.used_sacks || 0),
          remainingCapacity: Number(t.remaining_capacity ?? Math.max(0, Number(t.sack_capacity || 120) - Number(t.used_sacks || 0))),
          activeSlipsCount: Number(t.active_slips_count || 0),
          isInTransit: Boolean(t.is_in_transit)
        }));
      }
    } catch {
      // Fallback calculation via Supabase directly
    }

    const [{ data: dbTrucks }, { data: dbSlips }] = await Promise.all([
      supabase.from("trucks").select("*").eq("is_active", true).is("deleted_at", null).order("id"),
      supabase.from("load_slips").select("id, truck_id, status, total_loaded_sacks").is("deleted_at", null)
    ]);

    const doneStatuses = new Set(["REMITTED", "COMPLETED", "RECONCILED", "CANCELLED"]);
    const usage = new Map<string, { used: number; count: number; inTransit: boolean }>();
    (dbSlips || []).forEach((s: any) => {
      const st = String(s.status || "").toUpperCase();
      if (doneStatuses.has(st)) return;
      const cur = usage.get(s.truck_id) || { used: 0, count: 0, inTransit: false };
      cur.used += Number(s.total_loaded_sacks || 0);
      cur.count += 1;
      if (st === "IN_TRANSIT" || st === "IN-TRANSIT") cur.inTransit = true;
      usage.set(s.truck_id, cur);
    });

    return (dbTrucks || []).map((t: any) => {
      const cap = Number(t.sack_capacity ?? t.max_sack_capacity ?? 120);
      const u = usage.get(t.id) || { used: 0, count: 0, inTransit: false };
      return {
        truckId: t.id,
        plateNumber: t.plate_number,
        model: t.model,
        sackCapacity: cap,
        usedSacks: u.used,
        remainingCapacity: Math.max(0, cap - u.used),
        activeSlipsCount: u.count,
        isInTransit: u.inTransit
      };
    });
  }

  static async addTruck(truckData: Omit<TruckVehicle, "status"> & { status?: TruckVehicle["status"] }): Promise<{ success: boolean; truck?: TruckVehicle; message?: string }> {
    const cap = Math.max(1, Number(truckData.capacitySacks ?? truckData.sackCapacity ?? 120));
    const safeImageUrl = sanitizeStoredImageUrl(truckData.imageUrl) || null;
    const newTruck: TruckVehicle = {
      ...truckData,
      capacitySacks: cap,
      sackCapacity: cap,
      imageUrl: safeImageUrl || undefined,
      status: truckData.status || "Available"
    };

    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/trucks`, {
        method: "POST",
        body: JSON.stringify({
          id: truckData.id,
          plate_number: truckData.plateNumber,
          model: truckData.model,
          sack_capacity: cap,
          image_url: safeImageUrl
        })
      });
      if (res.ok) {
        const existing = this.getTrucks().filter(t => t.id !== newTruck.id);
        setStorageItem(STORAGE_KEYS.TRUCKS, [...existing, newTruck]);
        return { success: true, truck: newTruck };
      }
    } catch {
      // Fallback
    }

    const { error } = await supabase.from("trucks").upsert({
      id: truckData.id,
      plate_number: truckData.plateNumber,
      model: truckData.model,
      sack_capacity: cap,
      max_sack_capacity: cap,
      image_url: safeImageUrl,
      is_active: true,
      deleted_at: null,
      deleted_by: null
    }, { onConflict: "id" });

    if (error) return { success: false, message: error.message };
    const existing = this.getTrucks().filter(t => t.id !== newTruck.id);
    setStorageItem(STORAGE_KEYS.TRUCKS, [...existing, newTruck]);
    return { success: true, truck: newTruck };
  }

  static async updateTruck(id: string, updates: Partial<TruckVehicle>): Promise<{ success: boolean; truck?: TruckVehicle | null; message?: string }> {
    const cap = updates.capacitySacks !== undefined ? Math.max(1, Number(updates.capacitySacks)) : updates.sackCapacity;
    const existingTruck = this.getTrucks().find(t => t.id === id);
    const oldImageUrl = existingTruck?.imageUrl;
    const safeImageUrl =
      updates.imageUrl !== undefined ? sanitizeStoredImageUrl(updates.imageUrl) || null : undefined;

    const dbPayload: any = {};
    if (updates.plateNumber) dbPayload.plate_number = updates.plateNumber.trim().toUpperCase();
    if (updates.model) dbPayload.model = updates.model.trim();
    if (cap !== undefined) {
      dbPayload.sack_capacity = cap;
      dbPayload.max_sack_capacity = cap;
    }
    if (safeImageUrl !== undefined) dbPayload.image_url = safeImageUrl;

    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/trucks/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({
          plate_number: dbPayload.plate_number,
          model: dbPayload.model,
          sack_capacity: cap,
          ...(safeImageUrl !== undefined ? { image_url: safeImageUrl } : {})
        })
      });
      if (!res.ok) {
        const { error } = await supabase.from("trucks").update(dbPayload).eq("id", id);
        if (error) return { success: false, message: error.message };
      }
    } catch {
      const { error } = await supabase.from("trucks").update(dbPayload).eq("id", id);
      if (error) return { success: false, message: error.message };
    }

    if (safeImageUrl !== undefined && oldImageUrl && oldImageUrl !== safeImageUrl) {
      await deleteStorageImage(oldImageUrl);
    }

    const trucks = this.getTrucks();
    const index = trucks.findIndex(t => t.id === id);
    if (index >= 0) {
      trucks[index] = {
        ...trucks[index],
        ...updates,
        ...(cap !== undefined ? { capacitySacks: cap, sackCapacity: cap } : {}),
        ...(safeImageUrl !== undefined ? { imageUrl: safeImageUrl || undefined } : {})
      };
      setStorageItem(STORAGE_KEYS.TRUCKS, trucks);
      return { success: true, truck: trucks[index] };
    }
    return { success: true, truck: null };
  }

  static async deleteTruck(id: string, deletedBy?: string): Promise<{ success: boolean; message: string }> {
    const existing = this.getTrucks().find(t => t.id === id);
    const res = await this.softDeleteItem("trucks", id, deletedBy);
    if (res.success) {
      if (existing?.imageUrl) {
        await deleteStorageImage(existing.imageUrl);
        await supabase.from("trucks").update({ image_url: null }).eq("id", id);
      }
      const trucks = this.getTrucks().filter(t => t.id !== id);
      setStorageItem(STORAGE_KEYS.TRUCKS, trucks);
    }
    return res;
  }

  // --- USERS & PERSONNEL ---
  static getUsers(): UserAccount[] {
    const users = getStorageItem<UserAccount[]>(STORAGE_KEYS.USERS, []);
    return Array.isArray(users) ? users : [];
  }

  static getDrivers(): UserAccount[] {
    return this.getUsers().filter(u => u && u.role === "Driver" && u.active);
  }

  static getStaff(): UserAccount[] {
    return this.getUsers().filter(u => u && (u.role === "Staff" || u.role === "Owner") && u.active);
  }

  static async addUser(newUserData: Omit<UserAccount, "id" | "createdAt">): Promise<{ success: boolean; user?: UserAccount; message?: string }> {
    const id = generateUUID();
    const safePhoto = sanitizeStoredImageUrl(newUserData.photoUrl) || null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/users`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          id,
          full_name: newUserData.name,
          role: newUserData.role,
          username: newUserData.username || null,
          password: newUserData.password || "1234",
          mobile_pin: newUserData.password || "1234",
          phone_number: newUserData.phone || null,
          email: newUserData.email || null,
          assigned_truck_id: newUserData.assignedTruckId || null,
          photo_url: safePhoto
        })
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.user) {
        const created: UserAccount = {
          id: json.user.id,
          name: json.user.full_name,
          username: json.user.username,
          email: json.user.email || "",
          role: json.user.role,
          phone: json.user.phone_number,
          assignedTruckId: json.user.assigned_truck_id,
          photoUrl: sanitizeStoredImageUrl(json.user.photo_url),
          active: true,
          createdAt: json.user.created_at || new Date().toISOString()
        };
        setStorageItem(STORAGE_KEYS.USERS, [...this.getUsers(), created]);
        return { success: true, user: created };
      }
      return { success: false, message: json.detail || "Failed to create user." };
    } catch (err: any) {
      return { success: false, message: err.message || "Network error creating user." };
    }
  }

  static async updateUser(id: string, updates: Partial<UserAccount>): Promise<UserAccount | null> {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    const oldPhotoUrl = index >= 0 ? users[index].photoUrl : undefined;
    const safePhoto = updates.photoUrl !== undefined ? sanitizeStoredImageUrl(updates.photoUrl) || null : undefined;

    if (index >= 0) {
      users[index] = {
        ...users[index],
        ...updates,
        ...(safePhoto !== undefined ? { photoUrl: safePhoto || undefined } : {})
      };
      setStorageItem(STORAGE_KEYS.USERS, users);
    }

    try {
      await fetch(`${BACKEND_URL}/api/v1/users/${id}`, {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          full_name: updates.name,
          role: updates.role,
          username: updates.username,
          password: updates.password,
          mobile_pin: updates.password,
          phone_number: updates.phone,
          email: updates.email,
          assigned_truck_id: updates.assignedTruckId ?? null,
          ...(safePhoto !== undefined ? { photo_url: safePhoto } : {}),
          is_active: updates.active
        })
      });
    } catch {
      const dbPayload: any = {};
      if (updates.name) dbPayload.full_name = updates.name;
      if (updates.role) dbPayload.role = updates.role;
      if (updates.username !== undefined) dbPayload.username = updates.username;
      if (updates.phone !== undefined) dbPayload.phone_number = updates.phone;
      if (updates.email !== undefined) dbPayload.email = updates.email;
      if (safePhoto !== undefined) dbPayload.photo_url = safePhoto;
      if (updates.assignedTruckId !== undefined) dbPayload.assigned_truck_id = updates.assignedTruckId || null;
      if (Object.keys(dbPayload).length > 0) {
        await supabase.from("user_accounts").update(dbPayload).eq("id", id);
      }
    }

    if (safePhoto !== undefined && oldPhotoUrl && oldPhotoUrl !== safePhoto) {
      await deleteStorageImage(oldPhotoUrl);
    }

    return index >= 0 ? users[index] : null;
  }

  static async deleteUser(id: string, deletedBy?: string): Promise<void> {
    const existing = this.getUsers().find(u => u.id === id);
    const res = await this.softDeleteItem("user_accounts", id, deletedBy);
    if (res.success) {
      if (existing?.photoUrl) {
        await deleteStorageImage(existing.photoUrl);
        await supabase.from("user_accounts").update({ photo_url: null }).eq("id", id);
      }
      setStorageItem(STORAGE_KEYS.USERS, this.getUsers().filter(u => u.id !== id));
    }
  }

  static async resetUserPassword(userId: string, newPass: string, adminUserId?: string): Promise<{ success: boolean; message: string }> {
    if (!newPass || newPass.length < 4) {
      return { success: false, message: "Password must be at least 4 characters long." };
    }
    const adminId = adminUserId || this.getCurrentUser()?.id || "";
    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/auth/admin-reset-password`, {
        method: "POST",
        body: JSON.stringify({
          admin_user_id: adminId,
          target_user_id: userId,
          new_password: newPass
        })
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, message: json.message || "Password reset successfully." };
      }
      return { success: false, message: json.detail || "Unable to reset password." };
    } catch (e: any) {
      return { success: false, message: e.message || "Network error resetting password." };
    }
  }

  static async changeUserPassword(userIdOrUsername: string, oldPass: string, newPass: string): Promise<{ success: boolean; message: string }> {
    if (!newPass || newPass.length < 4) {
      return { success: false, message: "New password must be at least 4 characters long." };
    }
    const user = this.getUsers().find(
      u => u.id === userIdOrUsername || u.username?.toLowerCase() === userIdOrUsername.toLowerCase()
    );
    const targetId = user?.id || userIdOrUsername;

    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/auth/change-password`, {
        method: "POST",
        body: JSON.stringify({
          user_id: targetId,
          old_password: oldPass,
          new_password: newPass
        })
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, message: json.message || "Password changed successfully." };
      }
      return { success: false, message: json.detail || "Unable to change password." };
    } catch (e: any) {
      return { success: false, message: e.message || "Network error changing password." };
    }
  }

  // --- LOAD SLIPS, ATOMIC DISPATCH & SHIFT CLOSING ---
  static getHistoricalLoadSlips(): LoadSlip[] {
    const slips = getStorageItem<LoadSlip[]>(STORAGE_KEYS.LOAD_SLIPS, []);
    return Array.isArray(slips) ? slips : [];
  }

  static getYesterdayLoadSlip(): LoadSlip | null {
    const history = this.getHistoricalLoadSlips();
    return history.length > 0 ? history[0] : null;
  }

  static getTodayLoadSlipTemplate(): {
    isPrefilled: boolean;
    prefilledDate: string;
    loadSlip: LoadSlip;
  } {
    const yesterday = this.getYesterdayLoadSlip();
    const todayStr = getManilaDateString();
    const timeStr = getManilaTimeString();
    const currentUser = this.getCurrentUser();
    const trucks = this.getTrucks();
    const drivers = this.getDrivers();

    if (!yesterday || !Array.isArray(yesterday.items) || yesterday.items.length === 0) {
      const defaultSlip: LoadSlip = {
        id: `LS-${todayStr.replace(/-/g, "")}-01`,
        idempotencyKey: generateUUID(),
        date: todayStr,
        time: timeStr,
        truckId: trucks[0]?.id || "",
        truckPlate: trucks[0]?.plateNumber || "",
        inChargeId: currentUser?.id || "",
        inChargeName: currentUser?.name || "",
        driverId: drivers[0]?.id || "",
        driverName: drivers[0]?.name || "",
        status: "Draft",
        totalLoadedSacks: 0,
        totalDeliveredSacks: 0,
        totalReturnedSacks: 0,
        totalRevenue: 0,
        totalCashRevenue: 0,
        totalChargeRevenue: 0,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return { isPrefilled: false, prefilledDate: "", loadSlip: defaultSlip };
    }

    const products = this.getProducts();
    const resetItems = yesterday.items
      .filter(it => products.length === 0 || products.some(p => p.id === it.iceProductId || p.name === it.iceType))
      .map((item, index) => {
        const matchedProd = products.find(p => p.id === item.iceProductId || p.name === item.iceType);
        const unitPrice = matchedProd ? matchedProd.price : roundCurrency(item.unitPrice);
        const qty = item.plannedQty || 1;
        return {
          ...item,
          id: `ITEM-${Date.now()}-${index + 1}`,
          iceProductId: matchedProd?.id || item.iceProductId,
          iceType: matchedProd?.name || item.iceType,
          sackSize: matchedProd?.sackSize || item.sackSize,
          unitPrice,
          deliveredQty: 0,
          status: "Pending" as const,
          partialReason: undefined,
          deliveredAt: undefined,
          totalPrice: multiplyCurrency(qty, unitPrice)
        };
      });

    const totalLoadedSacks = resetItems.reduce((sum, item) => sum + (item.plannedQty || 0), 0);
    const totalCashRevenue = sumCurrency(resetItems.filter(i => i.paymentType === "Cash").map(i => i.totalPrice));
    const totalChargeRevenue = sumCurrency(resetItems.filter(i => i.paymentType === "Charge Invoice").map(i => i.totalPrice));

    const prefilledLoadSlip: LoadSlip = {
      id: `LS-${todayStr.replace(/-/g, "")}-01`,
      idempotencyKey: generateUUID(),
      date: todayStr,
      time: timeStr,
      truckId: yesterday.truckId || trucks[0]?.id || "",
      truckPlate: yesterday.truckPlate || trucks[0]?.plateNumber || "",
      inChargeId: currentUser?.id || "",
      inChargeName: currentUser?.name || "",
      driverId: yesterday.driverId || drivers[0]?.id || "",
      driverName: yesterday.driverName || drivers[0]?.name || "",
      status: "Draft",
      totalLoadedSacks,
      totalDeliveredSacks: 0,
      totalReturnedSacks: 0,
      totalRevenue: roundCurrency(totalCashRevenue + totalChargeRevenue),
      totalCashRevenue,
      totalChargeRevenue,
      items: resetItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return {
      isPrefilled: resetItems.length > 0,
      prefilledDate: yesterday.date || todayStr,
      loadSlip: prefilledLoadSlip
    };
  }

  /**
   * Dispatches Load Slip synchronously through FastAPI atomic RPC endpoint.
   * Rejects capacity overbooking cleanly with 409 message.
   */
  static async dispatchLoadSlip(loadSlip: LoadSlip): Promise<{
    success: boolean;
    message: string;
    statusCode?: number;
    loadSlip?: LoadSlip;
    remainingCapacity?: number;
    inTransitWarning?: boolean;
  }> {
    const locations = this.getLocations();
    const body = {
      slip_number: loadSlip.slipNumber || loadSlip.id,
      idempotency_key: loadSlip.idempotencyKey || generateUUID(),
      date: loadSlip.date || getManilaDateString(),
      departure_time: loadSlip.time || getManilaTimeString(),
      truck_id: loadSlip.truckId,
      driver_id: isUUID(loadSlip.driverId) ? loadSlip.driverId : null,
      driver_name: loadSlip.driverName,
      notes: loadSlip.notes || null,
      items: (loadSlip.items || []).map((item, idx) => {
        const hub = locations.find(l => l.id === item.locationId);
        return {
          idempotency_key: `${loadSlip.idempotencyKey}-item-${idx + 1}`,
          customer_id: isUUID(item.customerId) ? item.customerId : null,
          customer_name: item.storeName.trim(),
          hub_id: isUUID(item.locationId) ? item.locationId : null,
          hub_name: hub?.name || item.locationName || "Cagayan de Oro Hub",
          product_id: isUUID(item.iceProductId) ? item.iceProductId : null,
          product_name: item.iceType,
          sack_size: item.sackSize || "Standard Sack",
          planned_qty: Number(item.plannedQty) || 0,
          unit_price: roundCurrency(item.unitPrice),
          total_amount: roundCurrency(item.totalPrice),
          payment_mode: item.paymentType === "Charge Invoice" ? "Charge" : "Cash"
        };
      })
    };

    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/load-slips`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          statusCode: res.status,
          message: json.detail || "Unable to dispatch Load Slip."
        };
      }

      const savedMapped = json.data ? mapDbSlipToWeb(json.data) : { ...loadSlip, status: "DISPATCHED" as const };
      const existing = this.getHistoricalLoadSlips().filter(s => s.id !== savedMapped.id && s.idempotencyKey !== savedMapped.idempotencyKey);
      setStorageItem(STORAGE_KEYS.LOAD_SLIPS, [savedMapped, ...existing]);

      return {
        success: true,
        message: json.message || `Load Slip #${savedMapped.slipNumber || savedMapped.id} dispatched successfully!`,
        loadSlip: savedMapped,
        remainingCapacity: json.remaining_capacity,
        inTransitWarning: json.in_transit_warning
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || "Network error contacting dispatch server. Ensure you are online to prevent concurrent overbooking."
      };
    }
  }

  static async saveLoadSlip(loadSlip: LoadSlip) {
    return this.dispatchLoadSlip(loadSlip);
  }

  static async fetchPendingShiftClosings(): Promise<{
    slips: LoadSlip[];
    inTransitCount: number;
  }> {
    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/shift-closing/pending`);
      if (res.ok) {
        const json = await res.json();
        const slips = (json.data || []).map((s: any) => mapDbSlipToWeb(s));
        return {
          slips,
          inTransitCount: Number(json.in_transit_count || 0)
        };
      }
    } catch {
      // Fallback directly to Supabase filtering strictly DELIVERY_FINISHED / AWAITING_REMIT
    }

    const { data, error } = await supabase
      .from("load_slips")
      .select("*, load_slip_items(*, delivery_hubs(name)), trucks(plate_number, model)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return { slips: [], inTransitCount: 0 };
    }

    const finishedStatuses = new Set(["DELIVERY_FINISHED", "AWAITING_REMIT", "COMPLETED / PENDING REMITTANCE"]);
    const inTransitStatuses = new Set(["DISPATCHED", "ACTIVE", "PENDING", "IN_TRANSIT", "IN-TRANSIT"]);

    const finished = data.filter((r: any) => finishedStatuses.has(String(r.status || "").toUpperCase()));
    const inTransitCount = data.filter((r: any) => inTransitStatuses.has(String(r.status || "").toUpperCase())).length;

    return {
      slips: finished.map((s: any) => mapDbSlipToWeb(s)),
      inTransitCount
    };
  }

  static async confirmShiftRemit(slipId: string, notes?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/load-slips/${encodeURIComponent(slipId)}/confirm-remit`, {
        method: "POST",
        body: JSON.stringify({
          notes: notes || null,
          closed_at: getManilaTimeString()
        })
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        await this.fetchLiveFromSupabase();
        return { success: true, message: json.message || "Shift confirmed & remitted!" };
      }
      return { success: false, message: json.detail || "Failed to confirm shift closing." };
    } catch (err: any) {
      return { success: false, message: err?.message || "Network error confirming shift remit." };
    }
  }

  // --- LIVE TELEMETRY & SOS ---
  static getLiveTelemetry(): LiveTruckTelemetry[] {
    return getStorageItem<LiveTruckTelemetry[]>(STORAGE_KEYS.TELEMETRY, []);
  }

  static async fetchLiveTelemetry(): Promise<LiveTruckTelemetry[]> {
    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/telemetry/live`);
      if (res.ok) {
        const json = await res.json();
        const list = (json.data || []) as LiveTruckTelemetry[];
        setStorageItem(STORAGE_KEYS.TELEMETRY, list);
        return list;
      }
    } catch {
      // Fallback
    }
    return this.getLiveTelemetry();
  }

  static dispatchRescue(truckId: string): void {
    const telemetry = this.getLiveTelemetry().map(t => {
      if (t.truckId === truckId && t.sosAlert) {
        return {
          ...t,
          sosAlert: { ...t.sosAlert, dispatchedRescue: true }
        };
      }
      return t;
    });
    setStorageItem(STORAGE_KEYS.TELEMETRY, telemetry);
  }

  // --- HISTORY SEARCH & FILTERING ---
  static filterAndSortHistory({
    history,
    searchQuery,
    sortOrder,
    yearFilter,
    monthFilter,
    paymentStatusFilter
  }: {
    history: LoadSlip[];
    searchQuery: string;
    sortOrder: "latest" | "oldest";
    yearFilter?: string;
    monthFilter?: string;
    paymentStatusFilter: "ALL" | "Cash" | "Charge Invoice" | "Partial" | "Completed";
  }) {
    const safeHistory = Array.isArray(history) ? history : [];
    const normalizedQuery = (searchQuery || "").trim().toLowerCase();

    const filtered = safeHistory.filter(slip => {
      if (!slip) return false;
      const [year, month] = (slip.date || "").split("-");
      if (yearFilter && yearFilter !== "ALL" && year !== yearFilter) return false;
      if (monthFilter && monthFilter !== "ALL" && month !== monthFilter) return false;

      if (paymentStatusFilter !== "ALL") {
        if (paymentStatusFilter === "Cash" && (slip.totalCashRevenue || 0) <= 0) return false;
        if (paymentStatusFilter === "Charge Invoice" && (slip.totalChargeRevenue || 0) <= 0) return false;
        const stUpper = String(slip.status || "").toUpperCase();
        if (paymentStatusFilter === "Completed" && !["REMITTED", "COMPLETED", "RECONCILED"].includes(stUpper)) return false;
        if (paymentStatusFilter === "Partial") {
          const hasPartial = (slip.items || []).some(i => i && i.status === "Partial") || (slip.totalReturnedSacks || 0) > 0;
          if (!hasPartial) return false;
        }
      }

      if (normalizedQuery) {
        const matchesDriver = (slip.driverName || "").toLowerCase().includes(normalizedQuery);
        const matchesTruck =
          (slip.truckPlate || "").toLowerCase().includes(normalizedQuery) ||
          (slip.truckId || "").toLowerCase().includes(normalizedQuery);
        const matchesStore = (slip.items || []).some(item => item && (item.storeName || "").toLowerCase().includes(normalizedQuery));
        const matchesId =
          (slip.id || "").toLowerCase().includes(normalizedQuery) ||
          (slip.slipNumber || "").toLowerCase().includes(normalizedQuery);
        if (!matchesDriver && !matchesTruck && !matchesStore && !matchesId) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
      const timeB = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
      return sortOrder === "latest" ? timeB - timeA : timeA - timeB;
    });

    const kpi = {
      totalSacksLoaded: sorted.reduce((acc, s) => acc + (s.totalLoadedSacks || 0), 0),
      totalSacksDelivered: sorted.reduce((acc, s) => acc + (s.totalDeliveredSacks || 0), 0),
      totalSacksReturned: sorted.reduce((acc, s) => acc + (s.totalReturnedSacks || 0), 0),
      totalRevenue: sumCurrency(sorted.map(s => s.totalRevenue || 0)),
      totalCash: sumCurrency(sorted.map(s => s.totalCashRevenue || 0)),
      totalCharge: sumCurrency(sorted.map(s => s.totalChargeRevenue || 0)),
      totalSlips: sorted.length
    };

    return { results: sorted, kpi };
  }

  // --- INVOICES & COLLECTIONS LEDGER ---
  static getInvoices(): InvoiceRecord[] {
    const invs = getStorageItem<InvoiceRecord[]>(STORAGE_KEYS.INVOICES, []);
    return Array.isArray(invs) ? invs : [];
  }

  static async fetchInvoicesLive(): Promise<InvoiceRecord[]> {
    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/invoices`);
      if (res.ok) {
        const json = await res.json();
        const mapped = (json.data || []).map(mapDbInvoiceToWeb);
        setStorageItem(STORAGE_KEYS.INVOICES, mapped);
        return mapped;
      }
    } catch {
      // fallback below
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*, load_slips(slip_number, truck_id, truck_plate, driver_name, in_charge_name, status)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped = data.map(mapDbInvoiceToWeb);
      setStorageItem(STORAGE_KEYS.INVOICES, mapped);
      return mapped;
    }

    return this.getInvoices();
  }

  static async settleChargeInvoice(
    invoiceId: string,
    staffName?: string
  ): Promise<{ success: boolean; message: string; invoice?: InvoiceRecord }> {
    const currentActor = staffName || this.getCurrentUser()?.name || "Staff";
    try {
      const res = await this.authorizedFetch(`${BACKEND_URL}/api/v1/invoices/${encodeURIComponent(invoiceId)}/settle`, {
        method: "POST"
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        await this.fetchInvoicesLive();
        return {
          success: true,
          message: json.message || "Invoice marked as settled!",
          invoice: json.data ? mapDbInvoiceToWeb(json.data) : undefined
        };
      }
      return { success: false, message: json.detail || "Unable to settle invoice." };
    } catch {
      const now = new Date();
      const { error } = await supabase
        .from("invoices")
        .update({
          status: "Settled",
          settled_at: now.toISOString(),
          settled_by: currentActor
        })
        .eq("id", invoiceId);
      if (error) return { success: false, message: error.message };
      await this.fetchInvoicesLive();
      return { success: true, message: "Invoice marked as PAID / SETTLED." };
    }
  }

  static filterAndSortInvoices({
    invoices,
    searchQuery,
    sortOrder,
    yearFilter,
    monthFilter,
    statusFilter
  }: {
    invoices: InvoiceRecord[];
    searchQuery: string;
    sortOrder: "latest" | "oldest";
    yearFilter?: string;
    monthFilter?: string;
    statusFilter: "ALL" | "Pending Delivery" | "Cash Paid" | "Unpaid Charge" | "Settled Charge";
  }) {
    const safeInvoices = Array.isArray(invoices) ? invoices : [];
    const normalizedQuery = (searchQuery || "").trim().toLowerCase();

    const filtered = safeInvoices.filter(inv => {
      if (!inv) return false;
      const parts = (inv.date || "").split("-");
      const year = parts[0] || "";
      const month = parts[1] || "";
      if (yearFilter && yearFilter !== "ALL" && year !== yearFilter) return false;
      if (monthFilter && monthFilter !== "ALL" && month !== monthFilter) return false;
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;

      if (normalizedQuery) {
        const matchCust = (inv.customerName || "").toLowerCase().includes(normalizedQuery);
        const matchLoc = (inv.locationName || "").toLowerCase().includes(normalizedQuery);
        const matchInv = (inv.invoiceNumber || "").toLowerCase().includes(normalizedQuery);
        const matchSlip = (inv.slipNumber || "").toLowerCase().includes(normalizedQuery);
        const matchDriver = (inv.driverName || "").toLowerCase().includes(normalizedQuery);
        if (!matchCust && !matchLoc && !matchInv && !matchSlip && !matchDriver) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(a.issuedAt || a.date || 0).getTime();
      const timeB = new Date(b.issuedAt || b.date || 0).getTime();
      return sortOrder === "latest" ? timeB - timeA : timeA - timeB;
    });

    let totalCashCents = 0;
    let totalUnpaidCents = 0;
    let totalSettledCents = 0;
    let totalPendingCents = 0;
    let countCash = 0;
    let countUnpaid = 0;
    let countSettled = 0;
    let countPending = 0;

    for (const inv of safeInvoices) {
      if (!inv) continue;
      const cents = Math.round(roundCurrency(inv.totalAmount) * 100);
      if (inv.status === "Cash Paid") {
        totalCashCents += cents;
        countCash += 1;
      } else if (inv.status === "Unpaid Charge") {
        totalUnpaidCents += cents;
        countUnpaid += 1;
      } else if (inv.status === "Settled Charge") {
        totalSettledCents += cents;
        totalCashCents += cents;
        countSettled += 1;
      } else {
        totalPendingCents += cents;
        countPending += 1;
      }
    }

    return {
      results: sorted,
      kpi: {
        totalCashCollected: totalCashCents / 100,
        totalUnpaidCharge: totalUnpaidCents / 100,
        totalSettledCharge: totalSettledCents / 100,
        totalPendingDelivery: totalPendingCents / 100,
        totalOverall: (totalCashCents + totalUnpaidCents + totalPendingCents) / 100,
        countUnpaid,
        countSettled,
        countCash,
        countPending
      }
    };
  }

  // --- SHIFT RECONCILIATION ARCHIVE ---
  static getReconciliations(): any[] {
    return getStorageItem<any[]>(STORAGE_KEYS.RECONCILIATIONS, []);
  }

  static saveReconciliation(record: any): void {
    const list = this.getReconciliations();
    setStorageItem(STORAGE_KEYS.RECONCILIATIONS, [record, ...list]);
  }
}
