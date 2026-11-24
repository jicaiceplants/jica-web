import { DataService } from "./dataService";
import { INITIAL_PRODUCTS, INITIAL_LOCATIONS } from "./mockData";

export type IceType = {
  id: number;
  name: string;
  price: number;
};

export const store = {
  get locations() {
    return DataService.getLocations().map(l => l.name);
  },
  set locations(newLocs: string[]) {
    // For backward compatibility
  },
  get iceTypes(): IceType[] {
    return DataService.getProducts().map((p, index) => ({
      id: index + 1,
      name: p.name,
      price: p.price
    }));
  },
  set iceTypes(types: IceType[]) {
    // For backward compatibility
  },
  sackSizes: ["50kg Big Sack", "25kg Small Sack", "Standard Block"],
  paymentTypes: ["Cash", "Charge Invoice"]
};
