import { DataService } from "./dataService";

export type IceType = {
  id: number;
  name: string;
  price: number;
};

export const store = {
  get locations() {
    return DataService.getLocations().map(l => l.name);
  },
  get iceTypes(): IceType[] {
    return DataService.getProducts().map((p, index) => ({
      id: index + 1,
      name: p.name,
      price: p.price
    }));
  }
};
