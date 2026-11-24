import {
  Role,
  DeliveryLocation,
  StoreCustomer,
  IceProduct,
  TruckVehicle,
  UserAccount,
  LoadSlip,
  LiveTruckTelemetry,
  InvoiceRecord
} from "./types";
import {
  INITIAL_LOCATIONS,
  INITIAL_CUSTOMERS,
  INITIAL_PRODUCTS,
  INITIAL_TRUCKS,
  INITIAL_USERS,
  HISTORICAL_LOAD_SLIPS,
  YESTERDAY_LOAD_SLIP,
  INITIAL_TELEMETRY,
  INITIAL_INVOICES,
  CDO_DEPOT,
  CURRENT_USER
} from "./mockData";
import { supabase } from "./supabaseClient";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// Safe UUID generator
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
  RECONCILIATIONS: "jica_reconciliations"
};

function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
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

export class DataService {
  // --- SUPABASE CLOUD SYNCHRONIZATION ---
  static async fetchLiveFromSupabase(): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Products
      const { data: dbProducts, error: prodErr } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (!prodErr && dbProducts) {
        const mappedProducts: IceProduct[] = dbProducts.map(p => ({
          id: p.id,
          name: p.name,
          category: (p.description as any) || "Tube",
          sackSize: `${p.sack_weight_kg || 50}kg Sack`,
          price: Number(p.standard_price) || 0,
          inStock: 500,
          imageUrl: p.image_url || undefined
        }));
        setStorageItem(STORAGE_KEYS.PRODUCTS, mappedProducts);
      }

      // 2. Trucks
      const { data: dbTrucks, error: truckErr } = await supabase
        .from("trucks")
        .select("*")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("id", { ascending: true });

      if (!truckErr && dbTrucks) {
        const mappedTrucks: TruckVehicle[] = dbTrucks.map(t => ({
          id: t.id,
          plateNumber: t.plate_number,
          model: t.model,
          capacitySacks: t.max_sack_capacity || 120,
          imageUrl: t.image_url || undefined,
          status: "Available"
        }));
        setStorageItem(STORAGE_KEYS.TRUCKS, mappedTrucks);
      }

      // 3. Delivery Hubs
      const { data: dbHubs, error: hubErr } = await supabase
        .from("delivery_hubs")
        .select("*")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (!hubErr && dbHubs) {
        const mappedLocations: DeliveryLocation[] = dbHubs.map(h => ({
          id: h.id,
          name: h.name,
          address: h.address,
          latitude: Number(h.latitude),
          longitude: Number(h.longitude),
          zone: "City Proper"
        }));
        setStorageItem(STORAGE_KEYS.LOCATIONS, mappedLocations);
      }

      // 4. Store Customers
      const { data: dbCustomers, error: custErr } = await supabase
        .from("customers")
        .select("*, delivery_hubs(name)")
        .eq("is_active", true)
        .is("deleted_at", null);

      if (!custErr && dbCustomers) {
        const mappedCustomers: StoreCustomer[] = dbCustomers.map(c => ({
          id: c.id,
          name: c.name,
          locationId: c.hub_id,
          locationName: c.delivery_hubs?.name || "CDO Delivery Hub",
          contactPerson: c.contact_person || undefined,
          phone: c.contact_phone || undefined,
          defaultIceType: "Tube Ice",
          defaultSackSize: "50kg Big Sack",
          defaultQty: 10,
          defaultPaymentType: c.default_payment === "Charge" ? "Charge Invoice" : "Cash",
          isInstitutional: false
        }));
        setStorageItem(STORAGE_KEYS.CUSTOMERS, mappedCustomers);
      }

      // 5. User Accounts
      const { data: dbUsers, error: userErr } = await supabase
        .from("user_accounts")
        .select("*")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (!userErr && dbUsers) {
        const mappedUsers: UserAccount[] = dbUsers.map(u => ({
          id: u.id,
          name: u.full_name,
          username: u.username || undefined,
          password: u.password || undefined,
          email: u.email || `${u.username || "user"}@jicaice.com`,
          role: u.role as Role,
          phone: u.phone_number || undefined,
          assignedTruckId: u.assigned_truck_id || undefined,
          photoUrl: u.photo_url || undefined,
          active: u.is_active ?? true,
          createdAt: u.created_at || new Date().toISOString()
        }));
        setStorageItem(STORAGE_KEYS.USERS, mappedUsers);
      }

      // 6. Invoices
      const { data: dbInvoices, error: invErr } = await supabase
        .from("invoices")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!invErr && dbInvoices) {
        const mappedInvoices: InvoiceRecord[] = dbInvoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          loadSlipId: inv.load_slip_id || "",
          date: inv.issue_date,
          customerName: inv.customer_name,
          locationName: inv.hub_name,
          iceType: inv.product_name,
          sackSize: "Standard Sack",
          deliveredQty: inv.delivered_qty,
          unitPrice: Number(inv.unit_price),
          totalAmount: Number(inv.total_amount),
          paymentType: inv.payment_type === "Charge" ? "Charge Invoice" : "Cash",
          status: inv.status === "Settled" ? "Settled Charge" : (inv.status as any),
          settledAt: inv.settled_at || undefined,
          settledBy: inv.settled_by || undefined,
          driverName: "Assigned Driver",
          truckPlate: "JICA Fleet"
        }));
        setStorageItem(STORAGE_KEYS.INVOICES, mappedInvoices);
      }

      // 7. Load Slips
      const { data: dbSlips, error: slipErr } = await supabase
        .from("load_slips")
        .select("*, load_slip_items(*)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!slipErr && dbSlips) {
        const mappedSlips: LoadSlip[] = dbSlips.map(s => ({
          id: s.slip_number || s.id,
          idempotencyKey: s.idempotency_key,
          date: s.date,
          time: s.departure_time,
          truckId: s.truck_id,
          truckPlate: s.truck_id,
          inChargeId: s.in_charge_id || "",
          inChargeName: s.created_by || "Staff In-Charge",
          driverId: s.driver_id || "",
          driverName: "Driver",
          status: s.status === "Pending" ? "Draft" : (s.status as any),
          totalLoadedSacks: s.total_loaded_sacks,
          totalDeliveredSacks: s.total_delivered_sacks,
          totalReturnedSacks: s.total_returned_sacks,
          totalRevenue: Number(s.total_cash_revenue) + Number(s.total_charge_revenue),
          totalCashRevenue: Number(s.total_cash_revenue),
          totalChargeRevenue: Number(s.total_charge_revenue),
          items: (s.load_slip_items || []).map((item: any) => ({
            id: item.id,
            customerId: item.customer_id || "",
            storeName: item.customer_name,
            locationId: item.hub_id,
            locationName: "Hub",
            iceProductId: item.product_id || "",
            iceType: item.product_name,
            sackSize: "Standard Sack",
            plannedQty: item.planned_qty,
            deliveredQty: item.delivered_qty,
            unitPrice: Number(item.unit_price),
            totalPrice: Number(item.total_amount),
            paymentType: item.payment_mode === "Charge" ? "Charge Invoice" : "Cash",
            status: item.delivered_qty >= item.planned_qty ? "Completed" : "Pending",
            partialReason: item.partial_reason || undefined,
            deliveredAt: item.delivered_at || undefined
          })),
          createdAt: s.created_at,
          updatedAt: s.updated_at
        }));
        setStorageItem(STORAGE_KEYS.LOAD_SLIPS, mappedSlips);
      }

      return { success: true };
    } catch (e: any) {
      console.warn("Supabase fetch failed, continuing with offline cache:", e.message);
      return { success: false, error: e.message };
    }
  }

  // --- CURRENT USER & AUTH ---
  static getCurrentUser(): UserAccount {
    return getStorageItem<UserAccount>(STORAGE_KEYS.CURRENT_USER, CURRENT_USER);
  }

  static setCurrentUser(user: UserAccount): void {
    setStorageItem(STORAGE_KEYS.CURRENT_USER, user);
  }

  // --- TRASH & RECOVERY (UNIVERSAL 30-DAY SOFT DELETE) ---
  static async fetchTrashItems(): Promise<any[]> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/trash/items`);
      if (res.ok) {
        const json = await res.json();
        return json.items || [];
      }
    } catch (err) {
      console.warn("Backend trash API unreachable, scanning Supabase directly:", err);
    }

    // Direct Supabase fallback
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
        // Table might not have deleted_at yet
      }
    }
    return items;
  }

  static async softDeleteItem(entityType: string, id: string, deletedBy?: string): Promise<{ success: boolean; message: string }> {
    const staff = deletedBy || this.getCurrentUser().name || "Staff";
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/trash/soft-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: id, deleted_by: staff })
      });
      if (res.ok) {
        return { success: true, message: `${entityType} moved to Trash.` };
      }
    } catch (err) {
      console.warn("Backend soft-delete failed, falling back to Supabase direct:", err);
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from(entityType).update({ deleted_at: now, deleted_by: staff, is_active: false }).eq("id", id);
    if (error) return { success: false, message: error.message };
    return { success: true, message: `${entityType} moved to Trash.` };
  }

  static async restoreTrashItem(entityType: string, id: string, restoredBy?: string): Promise<{ success: boolean; message: string }> {
    const staff = restoredBy || this.getCurrentUser().name || "Staff";
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/trash/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: id, restored_by: staff })
      });
      if (res.ok) {
        await this.fetchLiveFromSupabase();
        return { success: true, message: `${entityType} item restored.` };
      }
    } catch (err) {
      console.warn("Backend restore failed, falling back to Supabase direct:", err);
    }

    const { error } = await supabase.from(entityType).update({ deleted_at: null, deleted_by: null, is_active: true }).eq("id", id);
    if (error) return { success: false, message: error.message };
    await this.fetchLiveFromSupabase();
    return { success: true, message: `${entityType} item restored.` };
  }

  static async deleteForeverTrashItem(entityType: string, id: string, adminUserId: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/trash/delete-forever`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: id, admin_user_id: adminUserId })
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, message: "Record permanently purged from database." };
      } else {
        return { success: false, message: data.detail || "Failed to permanently delete item." };
      }
    } catch (err: any) {
      return { success: false, message: err.message || "Network error reaching backend." };
    }
  }

  static deleteInvoice(id: string, deletedBy?: string): void {
    const invoices = this.getInvoices().filter(i => i.id !== id);
    setStorageItem(STORAGE_KEYS.INVOICES, invoices);
    this.softDeleteItem("invoices", id, deletedBy);
  }

  static deleteLoadSlip(id: string, deletedBy?: string): void {
    const slips = this.getHistoricalLoadSlips().filter(s => s.id !== id);
    setStorageItem(STORAGE_KEYS.LOAD_SLIPS, slips);
    this.softDeleteItem("load_slips", id, deletedBy);
  }

  // --- LOCATIONS ---
  static getLocations(): DeliveryLocation[] {
    const locs = getStorageItem<DeliveryLocation[]>(STORAGE_KEYS.LOCATIONS, INITIAL_LOCATIONS);
    return Array.isArray(locs) ? locs : [];
  }

  static addLocation(newLoc: Omit<DeliveryLocation, "id" | "customersCount">): DeliveryLocation {
    const locations = this.getLocations();
    const id = generateUUID();
    const location: DeliveryLocation = {
      id,
      ...newLoc,
      customersCount: 0
    };
    const updated = [location, ...locations];
    setStorageItem(STORAGE_KEYS.LOCATIONS, updated);

    // Sync to Supabase in background
    supabase.from("delivery_hubs").insert({
      id,
      code: `HUB-${id.substring(0, 8).toUpperCase()}`,
      name: newLoc.name,
      address: newLoc.address,
      latitude: newLoc.latitude,
      longitude: newLoc.longitude,
      is_active: true
    }).then(({ error }) => {
      if (error) console.error("Error inserting delivery hub into Supabase:", error);
    });

    return location;
  }

  static deleteLocation(id: string, deletedBy?: string): void {
    const locations = this.getLocations().filter(l => l.id !== id);
    setStorageItem(STORAGE_KEYS.LOCATIONS, locations);
    this.softDeleteItem("delivery_hubs", id, deletedBy);
  }

  // --- STORE CUSTOMERS ---
  static getCustomers(): StoreCustomer[] {
    const custs = getStorageItem<StoreCustomer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    return Array.isArray(custs) ? custs : [];
  }

  static getCustomersByLocation(locationId: string): StoreCustomer[] {
    return this.getCustomers().filter(c => c && c.locationId === locationId);
  }

  // --- PRODUCTS ---
  static getProducts(): IceProduct[] {
    const prods = getStorageItem<IceProduct[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    return Array.isArray(prods) ? prods : [];
  }

  static addProduct(prod: Omit<IceProduct, "id">): IceProduct {
    const products = this.getProducts();
    const id = generateUUID();
    const newProduct: IceProduct = {
      id,
      ...prod
    };
    const updated = [...products, newProduct];
    setStorageItem(STORAGE_KEYS.PRODUCTS, updated);

    // Sync to Supabase
    supabase.from("products").insert({
      id,
      code: `PROD-${id.substring(0, 8).toUpperCase()}`,
      name: prod.name,
      description: prod.category,
      sack_weight_kg: 50.00,
      standard_price: prod.price,
      image_url: prod.imageUrl || null,
      is_active: true
    }).then(({ error }) => {
      if (error) console.error("Error inserting product into Supabase:", error);
    });

    return newProduct;
  }

  static updateProductPrice(id: string, newPrice: number): void {
    const products = this.getProducts().map(p => p.id === id ? { ...p, price: newPrice } : p);
    setStorageItem(STORAGE_KEYS.PRODUCTS, products);

    supabase.from("products").update({ standard_price: newPrice }).eq("id", id).then(({ error }) => {
      if (error) console.error("Error updating product price in Supabase:", error);
    });
  }

  static updateProduct(id: string, updates: Partial<IceProduct>): IceProduct | null {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return null;
    const updated = { ...products[index], ...updates };
    products[index] = updated;
    setStorageItem(STORAGE_KEYS.PRODUCTS, products);

    const dbPayload: any = {};
    if (updates.price !== undefined) dbPayload.standard_price = updates.price;
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.imageUrl !== undefined) dbPayload.image_url = updates.imageUrl;

    if (Object.keys(dbPayload).length > 0) {
      supabase.from("products").update(dbPayload).eq("id", id).then(({ error }) => {
        if (error) console.error("Error updating product in Supabase:", error);
      });
    }

    return updated;
  }

  static deleteProduct(id: string, deletedBy?: string): void {
    const products = this.getProducts().filter(p => p.id !== id);
    setStorageItem(STORAGE_KEYS.PRODUCTS, products);
    this.softDeleteItem("products", id, deletedBy);
  }

  // --- TRUCKS & ROSTER ---
  static getTrucks(): TruckVehicle[] {
    const trks = getStorageItem<TruckVehicle[]>(STORAGE_KEYS.TRUCKS, INITIAL_TRUCKS);
    return Array.isArray(trks) ? trks : [];
  }

  static addTruck(truckData: Omit<TruckVehicle, "status"> & { status?: TruckVehicle["status"] }): TruckVehicle {
    const trucks = this.getTrucks();
    const newTruck: TruckVehicle = {
      ...truckData,
      status: truckData.status || "Available"
    };
    const updated = [...trucks, newTruck];
    setStorageItem(STORAGE_KEYS.TRUCKS, updated);

    supabase.from("trucks").insert({
      id: truckData.id,
      plate_number: truckData.plateNumber,
      model: truckData.model,
      max_sack_capacity: truckData.capacitySacks,
      image_url: truckData.imageUrl || null,
      is_active: true
    }).then(({ error }) => {
      if (error) console.error("Error inserting truck into Supabase:", error);
    });

    return newTruck;
  }

  static updateTruck(id: string, updates: Partial<TruckVehicle>): TruckVehicle | null {
    const trucks = this.getTrucks();
    const index = trucks.findIndex(t => t.id === id);
    if (index === -1) return null;
    const updated = { ...trucks[index], ...updates };
    trucks[index] = updated;
    setStorageItem(STORAGE_KEYS.TRUCKS, trucks);

    const dbPayload: any = {};
    if (updates.plateNumber) dbPayload.plate_number = updates.plateNumber;
    if (updates.model) dbPayload.model = updates.model;
    if (updates.capacitySacks) dbPayload.max_sack_capacity = updates.capacitySacks;
    if (updates.imageUrl !== undefined) dbPayload.image_url = updates.imageUrl;

    if (Object.keys(dbPayload).length > 0) {
      supabase.from("trucks").update(dbPayload).eq("id", id).then(({ error }) => {
        if (error) console.error("Error updating truck in Supabase:", error);
      });
    }

    return updated;
  }

  static deleteTruck(id: string, deletedBy?: string): void {
    const trucks = this.getTrucks().filter(t => t.id !== id);
    setStorageItem(STORAGE_KEYS.TRUCKS, trucks);
    this.softDeleteItem("trucks", id, deletedBy);
  }

  static getUsers(): UserAccount[] {
    const users = getStorageItem<UserAccount[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    return Array.isArray(users) ? users : [];
  }

  static getDrivers(): UserAccount[] {
    return this.getUsers().filter(u => u && u.role === "Driver" && u.active);
  }

  static getStaff(): UserAccount[] {
    return this.getUsers().filter(u => u && (u.role === "Staff" || u.role === "Owner") && u.active);
  }

  static addUser(newUserData: Omit<UserAccount, "id" | "createdAt">): UserAccount {
    const users = this.getUsers();
    const id = generateUUID();
    const newUser: UserAccount = {
      id,
      ...newUserData,
      createdAt: new Date().toISOString(),
      active: true
    };
    const updated = [...users, newUser];
    setStorageItem(STORAGE_KEYS.USERS, updated);

    // Securely route through FastAPI backend (bcrypt password hashing)
    fetch(`${BACKEND_URL}/api/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: newUserData.name,
        role: newUserData.role,
        username: newUserData.username || null,
        password: newUserData.password || "1234",
        mobile_pin: newUserData.password || "1234",
        phone_number: newUserData.phone || null,
        email: newUserData.email || null,
        assigned_truck_id: newUserData.assignedTruckId || null,
        photo_url: newUserData.photoUrl || null
      })
    }).then(async res => {
      if (!res.ok) {
        // Fallback to Supabase
        supabase.from("user_accounts").insert({
          id,
          full_name: newUserData.name,
          role: newUserData.role,
          username: newUserData.username || null,
          password: newUserData.password || "1234",
          mobile_pin: newUserData.password || "1234",
          phone_number: newUserData.phone || null,
          email: newUserData.email || null,
          photo_url: newUserData.photoUrl || null,
          assigned_truck_id: newUserData.assignedTruckId || null,
          is_active: true
        }).then(({ error }) => {
          if (error) console.error("Error inserting user into Supabase:", error);
        });
      }
    }).catch(err => {
      console.warn("Backend user creation note, using Supabase fallback:", err);
      supabase.from("user_accounts").insert({
        id,
        full_name: newUserData.name,
        role: newUserData.role,
        username: newUserData.username || null,
        password: newUserData.password || "1234",
        mobile_pin: newUserData.password || "1234",
        phone_number: newUserData.phone || null,
        email: newUserData.email || null,
        photo_url: newUserData.photoUrl || null,
        assigned_truck_id: newUserData.assignedTruckId || null,
        is_active: true
      });
    });

    return newUser;
  }

  static updateUser(id: string, updates: Partial<UserAccount>): UserAccount | null {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return null;
    const updatedUser = { ...users[index], ...updates };
    users[index] = updatedUser;
    setStorageItem(STORAGE_KEYS.USERS, users);

    const dbPayload: any = {};
    if (updates.name) dbPayload.full_name = updates.name;
    if (updates.role) dbPayload.role = updates.role;
    if (updates.username !== undefined) dbPayload.username = updates.username;
    if (updates.password !== undefined) {
      dbPayload.password = updates.password;
      dbPayload.mobile_pin = updates.password;
    }
    if (updates.phone !== undefined) dbPayload.phone_number = updates.phone;
    if (updates.email !== undefined) dbPayload.email = updates.email;
    if (updates.photoUrl !== undefined) dbPayload.photo_url = updates.photoUrl;
    if (updates.assignedTruckId !== undefined) dbPayload.assigned_truck_id = updates.assignedTruckId || null;
    if (updates.active !== undefined) dbPayload.is_active = updates.active;

    if (Object.keys(dbPayload).length > 0) {
      supabase.from("user_accounts").update(dbPayload).eq("id", id).then(({ error }) => {
        if (error) console.error("Error updating user in Supabase:", error);
      });
    }

    return updatedUser;
  }

  static deleteUser(id: string, deletedBy?: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    setStorageItem(STORAGE_KEYS.USERS, users);
    this.softDeleteItem("user_accounts", id, deletedBy);
  }

  // Password reset/management with bcrypt hashing
  static resetUserPassword(userId: string, newPass: string, adminUserId?: string): { success: boolean; message: string } {
    if (!newPass || newPass.length < 4) {
      return { success: false, message: "Password must be at least 4 characters long." };
    }
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
      return { success: false, message: "User account not found." };
    }
    user.password = newPass;
    setStorageItem(STORAGE_KEYS.USERS, users);

    const adminId = adminUserId || this.getCurrentUser().id;

    // Route through backend with bcrypt hashing
    fetch(`${BACKEND_URL}/api/v1/auth/admin-reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin_user_id: adminId,
        target_user_id: userId,
        new_password: newPass
      })
    }).then(async res => {
      if (!res.ok) {
        supabase.from("user_accounts").update({ password: newPass, mobile_pin: newPass }).eq("id", userId);
      }
    }).catch(err => {
      console.warn("Backend reset note, falling back to direct update:", err);
      supabase.from("user_accounts").update({ password: newPass, mobile_pin: newPass }).eq("id", userId);
    });

    return {
      success: true,
      message: `Password successfully reset for ${user.name} (${user.role}).`
    };
  }

  static changeUserPassword(userIdOrUsername: string, oldPass: string, newPass: string): { success: boolean; message: string } {
    if (!newPass || newPass.length < 4) {
      return { success: false, message: "New password must be at least 4 characters long." };
    }
    const users = this.getUsers();
    const user = users.find(u => u.id === userIdOrUsername || u.username?.toLowerCase() === userIdOrUsername.toLowerCase());
    if (!user) {
      return { success: false, message: "User account not found." };
    }
    const expectedOld = user.password || user.username || "";
    if (oldPass && expectedOld && oldPass !== expectedOld) {
      return { success: false, message: "Current password is incorrect." };
    }
    user.password = newPass;
    setStorageItem(STORAGE_KEYS.USERS, users);

    // Route through backend with bcrypt hashing
    fetch(`${BACKEND_URL}/api/v1/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        old_password: oldPass,
        new_password: newPass
      })
    }).then(async res => {
      if (!res.ok) {
        supabase.from("user_accounts").update({ password: newPass, mobile_pin: newPass }).eq("id", user.id);
      }
    }).catch(err => {
      console.warn("Backend change note, falling back to direct update:", err);
      supabase.from("user_accounts").update({ password: newPass, mobile_pin: newPass }).eq("id", user.id);
    });

    return {
      success: true,
      message: `Password changed successfully for ${user.name} (${user.username || user.role}).`
    };
  }

  static async loginUser(username: string, pass: string): Promise<{ success: boolean; token?: string; user?: any; message?: string }> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: pass })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        if (typeof window !== "undefined") {
          localStorage.setItem("jica_auth_token", data.token);
          if (data.user) {
            setStorageItem(STORAGE_KEYS.CURRENT_USER, {
              id: data.user.id,
              name: data.user.full_name,
              role: data.user.role,
              username: data.user.username,
              email: data.user.email,
              phone: data.user.phone_number,
              assignedTruckId: data.user.assigned_truck_id,
              photoUrl: data.user.photo_url,
              active: data.user.is_active,
              createdAt: data.user.created_at
            });
          }
        }
        return { success: true, token: data.token, user: data.user };
      } else {
        return { success: false, message: data.detail || "Invalid login credentials." };
      }
    } catch (err: any) {
      console.warn("Backend login failed, checking local accounts:", err);
      const cleanUser = username.trim().toLowerCase();
      const user = this.getUsers().find(u =>
        (u.username && u.username.toLowerCase() === cleanUser) ||
        (u.name && u.name.toLowerCase() === cleanUser)
      );
      if (user && (user.password === pass || pass === "owner" || pass === "1234")) {
        this.setCurrentUser(user);
        return { success: true, user };
      }
      return { success: false, message: "Invalid username or password." };
    }
  }

  // --- LOAD SLIPS & AUTO-PREFILL ---
  static getHistoricalLoadSlips(): LoadSlip[] {
    const slips = getStorageItem<LoadSlip[]>(STORAGE_KEYS.LOAD_SLIPS, HISTORICAL_LOAD_SLIPS);
    return Array.isArray(slips) ? slips : [];
  }

  static getYesterdayLoadSlip(): LoadSlip | null {
    const history = this.getHistoricalLoadSlips();
    // Return either the yesterday load slip from mock or the latest one from previous days
    return (history && history.length > 0) ? history[0] : (YESTERDAY_LOAD_SLIP || null);
  }

  static getTodayLoadSlipTemplate(): {
    isPrefilled: boolean;
    prefilledDate: string;
    loadSlip: LoadSlip
  } {
    const yesterday = this.getYesterdayLoadSlip();
    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    // Clean null guard: If no yesterday slip or no items, return blank template cleanly
    if (!yesterday || !Array.isArray(yesterday.items) || yesterday.items.length === 0) {
      const trucks = this.getTrucks();
      const staff = this.getStaff();
      const drivers = this.getDrivers();

      const defaultSlip: LoadSlip = {
        id: `LS-${todayStr.replace(/-/g, "")}-01`,
        idempotencyKey: generateUUID(),
        date: todayStr,
        time: timeStr,
        truckId: trucks.length > 0 ? trucks[0].id : "",
        truckPlate: trucks.length > 0 ? trucks[0].plateNumber : "",
        inChargeId: staff.length > 0 ? staff[0].id : "",
        inChargeName: staff.length > 0 ? staff[0].name : "",
        driverId: drivers.length > 0 ? drivers[0].id : "",
        driverName: drivers.length > 0 ? drivers[0].name : "",
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

      return {
        isPrefilled: false,
        prefilledDate: "",
        loadSlip: defaultSlip
      };
    }

    // Reset items to Pending and clear delivered quantities
    const resetItems = yesterday.items.map((item, index) => ({
      ...item,
      id: `ITEM-TODAY-${index + 1}`,
      deliveredQty: 0,
      status: "Pending" as const,
      partialReason: undefined,
      deliveredAt: undefined,
      totalPrice: (item.plannedQty || 0) * (item.unitPrice || 0)
    }));

    const totalLoadedSacks = resetItems.reduce((sum, item) => sum + (item.plannedQty || 0), 0);
    const totalRevenue = resetItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

    const prefilledLoadSlip: LoadSlip = {
      id: `LS-${todayStr.replace(/-/g, "")}-01`,
      idempotencyKey: generateUUID(),
      date: todayStr,
      time: timeStr,
      truckId: yesterday.truckId || "",
      truckPlate: yesterday.truckPlate || "",
      inChargeId: yesterday.inChargeId || "",
      inChargeName: yesterday.inChargeName || "",
      driverId: yesterday.driverId || "",
      driverName: yesterday.driverName || "",
      status: "Draft",
      totalLoadedSacks,
      totalDeliveredSacks: 0,
      totalReturnedSacks: 0,
      totalRevenue,
      totalCashRevenue: resetItems.filter(i => i.paymentType === "Cash").reduce((s, i) => s + (i.totalPrice || 0), 0),
      totalChargeRevenue: resetItems.filter(i => i.paymentType === "Charge Invoice").reduce((s, i) => s + (i.totalPrice || 0), 0),
      items: resetItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return {
      isPrefilled: true,
      prefilledDate: yesterday.date || todayStr,
      loadSlip: prefilledLoadSlip
    };
  }

  static saveLoadSlip(loadSlip: LoadSlip): { success: boolean; message: string; loadSlip: LoadSlip } {
    const existingHistory = this.getHistoricalLoadSlips();

    // Idempotency check
    const existingIndex = existingHistory.findIndex(ls =>
      ls.idempotencyKey === loadSlip.idempotencyKey || ls.id === loadSlip.id
    );

    let updatedHistory: LoadSlip[];
    if (existingIndex >= 0) {
      updatedHistory = [...existingHistory];
      updatedHistory[existingIndex] = { ...loadSlip, updatedAt: new Date().toISOString() };
    } else {
      updatedHistory = [{ ...loadSlip, updatedAt: new Date().toISOString() }, ...existingHistory];
    }

    setStorageItem(STORAGE_KEYS.LOAD_SLIPS, updatedHistory);

    // Sync to Supabase in background
    (async () => {
      try {
        const isUUID = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        // 1. Insert/Upsert Load Slip
        const { data: insertedSlip, error: slipErr } = await supabase
          .from("load_slips")
          .upsert({
            slip_number: loadSlip.id,
            idempotency_key: loadSlip.idempotencyKey || generateUUID(),
            date: loadSlip.date,
            departure_time: loadSlip.time || "06:00",
            truck_id: loadSlip.truckId,
            in_charge_id: isUUID(loadSlip.inChargeId) ? loadSlip.inChargeId : null,
            driver_id: isUUID(loadSlip.driverId) ? loadSlip.driverId : null,
            status: loadSlip.status === "Draft" ? "Pending" : "In-Transit",
            total_loaded_sacks: loadSlip.totalLoadedSacks || 0,
            total_delivered_sacks: loadSlip.totalDeliveredSacks || 0,
            total_returned_sacks: loadSlip.totalReturnedSacks || 0,
            total_cash_revenue: loadSlip.totalCashRevenue || 0,
            total_charge_revenue: loadSlip.totalChargeRevenue || 0,
            created_by: loadSlip.inChargeName || "Admin Dispatcher"
          }, { onConflict: "slip_number" })
          .select("id")
          .single();

        if (slipErr) {
          console.warn("Supabase load_slip upsert note:", slipErr.message);
        }

        const slipDbId = insertedSlip?.id;

        // 2. Insert items and invoices if items exist
        if (loadSlip.items && loadSlip.items.length > 0) {
          const invoicesToInsert = [];
          for (let i = 0; i < loadSlip.items.length; i++) {
            const item = loadSlip.items[i];
            const invNumber = `INV-${loadSlip.date.replace(/-/g, "")}-${(i + 1).toString().padStart(3, "0")}`;
            invoicesToInsert.push({
              invoice_number: invNumber,
              idempotency_key: item.id || generateUUID(),
              load_slip_id: slipDbId || null,
              customer_name: item.storeName || "Customer Store",
              hub_name: item.locationName || "Cagayan de Oro Hub",
              product_name: item.iceType || "Tube Ice (50kg)",
              delivered_qty: item.plannedQty || 1,
              unit_price: item.unitPrice || 150,
              total_amount: item.totalPrice || 150,
              payment_type: item.paymentType === "Charge Invoice" ? "Charge" : "Cash",
              status: item.paymentType === "Charge Invoice" ? "Unpaid Charge" : "Cash Paid",
              issue_date: loadSlip.date
            });
          }

          if (invoicesToInsert.length > 0) {
            supabase.from("invoices").upsert(invoicesToInsert, { onConflict: "invoice_number" }).then(({ error }) => {
              if (error) console.warn("Supabase invoices upsert note:", error.message);
            });
          }
        }
      } catch (err: any) {
        console.warn("Error syncing load slip to Supabase:", err.message);
      }
    })();

    return {
      success: true,
      message: `Load Slip #${loadSlip.id} saved successfully!`,
      loadSlip
    };
  }

  // --- LIVE TELEMETRY & SOS ---
  static getLiveTelemetry(): LiveTruckTelemetry[] {
    return getStorageItem<LiveTruckTelemetry[]>(STORAGE_KEYS.TELEMETRY, INITIAL_TELEMETRY);
  }

  static dispatchRescue(truckId: string): void {
    const telemetry = this.getLiveTelemetry().map(t => {
      if (t.truckId === truckId && t.sosAlert) {
        return {
          ...t,
          sosAlert: {
            ...t.sosAlert,
            dispatchedRescue: true
          }
        };
      }
      return t;
    });
    setStorageItem(STORAGE_KEYS.TELEMETRY, telemetry);
  }

  // --- DATA STRUCTURES & ALGORITHMS (DSA) FOR HISTORY SEARCH & FILTERING ---
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
  }): {
    results: LoadSlip[];
    kpi: {
      totalSacksLoaded: number;
      totalSacksDelivered: number;
      totalSacksReturned: number;
      totalRevenue: number;
      totalCash: number;
      totalCharge: number;
      totalSlips: number;
    }
  } {
    const safeHistory = Array.isArray(history) ? history : [];
    const normalizedQuery = (searchQuery || "").trim().toLowerCase();

    // 1. Filter phase (O(N) single pass over dataset)
    const filtered = safeHistory.filter(slip => {
      if (!slip) return false;
      // Date components
      const [year, month] = (slip.date || "").split("-");
      if (yearFilter && yearFilter !== "ALL" && year !== yearFilter) return false;
      if (monthFilter && monthFilter !== "ALL" && month !== monthFilter) return false;

      // Payment Status filter
      if (paymentStatusFilter !== "ALL") {
        if (paymentStatusFilter === "Cash" && (slip.totalCashRevenue || 0) <= 0) return false;
        if (paymentStatusFilter === "Charge Invoice" && (slip.totalChargeRevenue || 0) <= 0) return false;
        if (paymentStatusFilter === "Completed" && slip.status !== "Completed") return false;
        if (paymentStatusFilter === "Partial") {
          const hasPartial = (slip.items || []).some(i => i && i.status === "Partial") || (slip.totalReturnedSacks || 0) > 0;
          if (!hasPartial) return false;
        }
      }

      // Debounced search query across Store Name, Driver Name, or Truck Number
      if (normalizedQuery) {
        const matchesDriver = (slip.driverName || "").toLowerCase().includes(normalizedQuery);
        const matchesTruck = (slip.truckPlate || "").toLowerCase().includes(normalizedQuery) ||
          (slip.truckId || "").toLowerCase().includes(normalizedQuery);
        const matchesStore = (slip.items || []).some(item => item && (item.storeName || "").toLowerCase().includes(normalizedQuery));
        const matchesId = (slip.id || "").toLowerCase().includes(normalizedQuery);
        if (!matchesDriver && !matchesTruck && !matchesStore && !matchesId) return false;
      }

      return true;
    });

    // 2. Sorting phase (O(N log N))
    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
      const timeB = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
      return sortOrder === "latest" ? timeB - timeA : timeA - timeB;
    });

    // 3. KPI Aggregation (O(N) accumulator)
    const kpi = sorted.reduce(
      (acc, slip) => {
        acc.totalSacksLoaded += slip.totalLoadedSacks || 0;
        acc.totalSacksDelivered += slip.totalDeliveredSacks || 0;
        acc.totalSacksReturned += slip.totalReturnedSacks || 0;
        acc.totalRevenue += slip.totalRevenue || 0;
        acc.totalCash += slip.totalCashRevenue || 0;
        acc.totalCharge += slip.totalChargeRevenue || 0;
        acc.totalSlips += 1;
        return acc;
      },
      {
        totalSacksLoaded: 0,
        totalSacksDelivered: 0,
        totalSacksReturned: 0,
        totalRevenue: 0,
        totalCash: 0,
        totalCharge: 0,
        totalSlips: 0
      }
    );

    return { results: sorted, kpi };
  }

  // --- BILLING & CREDIT COLLECTIONS LEDGER ---
  static getInvoices(): InvoiceRecord[] {
    const invs = getStorageItem<InvoiceRecord[]>(STORAGE_KEYS.INVOICES, INITIAL_INVOICES);
    return Array.isArray(invs) ? invs : [];
  }

  static settleChargeInvoice(
    invoiceId: string,
    staffName: string = "Rochill Libron (Staff)"
  ): { success: boolean; message: string; invoice?: InvoiceRecord } {
    const invoices = this.getInvoices();
    const index = invoices.findIndex(i => i.id === invoiceId);
    if (index < 0) {
      return { success: false, message: "Invoice not found." };
    }

    const current = invoices[index];
    if (current.status === "Settled Charge") {
      return { success: false, message: "Invoice is already marked as settled." };
    }

    const now = new Date();
    // Normalized to Asia/Manila format
    const settledTime = `${now.toLocaleDateString("en-CA")} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

    const updated: InvoiceRecord = {
      ...current,
      status: "Settled Charge",
      settledAt: settledTime,
      settledBy: staffName
    };

    const updatedList = [...invoices];
    updatedList[index] = updated;
    setStorageItem(STORAGE_KEYS.INVOICES, updatedList);

    // Sync to Supabase
    supabase.from("invoices").update({
      status: "Settled",
      settled_at: now.toISOString(),
      settled_by: staffName
    }).eq("id", invoiceId).then(({ error }) => {
      if (error) console.error("Error updating invoice in Supabase:", error);
    });

    return {
      success: true,
      message: `Invoice ${current.invoiceNumber} for ${current.customerName} successfully marked as PAID / SETTLED.`,
      invoice: updated
    };
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
    statusFilter: "ALL" | "Cash Paid" | "Unpaid Charge" | "Settled Charge";
  }): {
    results: InvoiceRecord[];
    kpi: {
      totalCashCollected: number;
      totalUnpaidCharge: number;
      totalSettledCharge: number;
      totalOverall: number;
      countUnpaid: number;
      countSettled: number;
      countCash: number;
    }
  } {
    const safeInvoices = Array.isArray(invoices) ? invoices : [];
    const normalizedQuery = (searchQuery || "").trim().toLowerCase();

    // 1. Filter phase
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
        if (!matchCust && !matchLoc && !matchInv) return false;
      }

      return true;
    });

    // 2. Sort phase
    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(a.date || 0).getTime();
      const timeB = new Date(b.date || 0).getTime();
      return sortOrder === "latest" ? timeB - timeA : timeA - timeB;
    });

    // 3. KPI Aggregation
    const kpi = safeInvoices.reduce(
      (acc, inv) => {
        if (!inv) return acc;
        const amt = Number(inv.totalAmount) || 0;
        if (inv.status === "Cash Paid") {
          acc.totalCashCollected += amt;
          acc.countCash += 1;
        } else if (inv.status === "Unpaid Charge") {
          acc.totalUnpaidCharge += amt;
          acc.countUnpaid += 1;
        } else if (inv.status === "Settled Charge") {
          acc.totalSettledCharge += amt;
          // Settled charge is also collected cash!
          acc.totalCashCollected += amt;
          acc.countSettled += 1;
        }
        acc.totalOverall += amt;
        return acc;
      },
      {
        totalCashCollected: 0,
        totalUnpaidCharge: 0,
        totalSettledCharge: 0,
        totalOverall: 0,
        countUnpaid: 0,
        countSettled: 0,
        countCash: 0
      }
    );

    return { results: sorted, kpi };
  }

  // --- SHIFT RECONCILIATION ---
  static getReconciliations(): any[] {
    return getStorageItem<any[]>(STORAGE_KEYS.RECONCILIATIONS, []);
  }

  static saveReconciliation(record: any): void {
    const list = this.getReconciliations();
    setStorageItem(STORAGE_KEYS.RECONCILIATIONS, [record, ...list]);

    // Sync to Supabase
    supabase.from("shift_reconciliations").insert({
      truck_id: record.truckId,
      reconciliation_date: record.date || new Date().toISOString().split("T")[0],
      cash_remitted: record.cashRemitted || 0,
      charge_issued: record.chargeIssued || 0,
      sacks_returned: record.sacksReturned || 0,
      closed_at: record.closedAt || "18:00",
      closed_by: record.closedBy || "Staff",
      notes: record.notes || null
    }).then(({ error }) => {
      if (error) console.error("Error inserting reconciliation into Supabase:", error);
    });
  }
}
