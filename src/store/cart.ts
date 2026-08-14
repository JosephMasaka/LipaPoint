import { create } from "zustand";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sku: string;
  unitId: string;
  unitName: string;
  unitAbbreviation: string;
  conversionFactor: number;
  productUomId: string | null;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: (taxRate: number) => number;
  getTotal: (taxRate: number) => number;
}

function cartKey(item: { id: string; unitId: string }) {
  return `${item.id}::${item.unitId}`;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => {
    set((state) => {
      const key = cartKey(item);
      const existingItem = state.items.find(
        (i) => cartKey(i) === key
      );

      if (existingItem) {
        return {
          items: state.items.map((i) =>
            cartKey(i) === key
              ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
              : i
          ),
        };
      }

      return {
        items: [
          ...state.items,
          { ...item, quantity: item.quantity ?? 1 },
        ],
      };
    });
  },

  removeItem: (key) => {
    set((state) => ({
      items: state.items.filter((i) => cartKey(i) !== key),
    }));
  },

  updateQuantity: (key, quantity) => {
    if (quantity <= 0) {
      get().removeItem(key);
      return;
    }

    set((state) => ({
      items: state.items.map((i) =>
        cartKey(i) === key ? { ...i, quantity } : i
      ),
    }));
  },

  clearCart: () => {
    set({ items: [] });
  },

  getSubtotal: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  getTax: (taxRate: number) => {
    const subtotal = get().getSubtotal();
    return subtotal * (taxRate / 100);
  },

  getTotal: (taxRate: number) => {
    const subtotal = get().getSubtotal();
    const tax = get().getTax(taxRate);
    return subtotal + tax;
  },
}));

export { cartKey };
