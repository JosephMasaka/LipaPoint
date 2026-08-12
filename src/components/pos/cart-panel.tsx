"use client";

import { useState } from "react";
import { Minus, Plus, Trash2, CreditCard, Banknote, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart";
import { cn } from "@/lib/utils";

export function CartPanel() {
  const { items, updateQuantity, removeItem, clearCart, getTotal, getTax, getGrandTotal } =
    useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<string>("card");

  const handleCheckout = async () => {
    if (items.length === 0) return;

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
          })),
          total: getGrandTotal(),
          tax: getTax(),
          paymentMethod,
        }),
      });

      if (response.ok) {
        clearCart();
      }
    } catch {
      // Offline: store in IndexedDB for later sync
      storeOfflineOrder();
    }
  };

  const storeOfflineOrder = () => {
    if (typeof window === "undefined") return;
    const offlineOrders = JSON.parse(
      localStorage.getItem("lipapoint_offline_orders") || "[]"
    );
    offlineOrders.push({
      items,
      total: getGrandTotal(),
      tax: getTax(),
      paymentMethod,
      timestamp: Date.now(),
    });
    localStorage.setItem("lipapoint_offline_orders", JSON.stringify(offlineOrders));
    clearCart();
  };

  return (
    <div className="w-96 flex flex-col bg-zinc-950 border-l border-zinc-800">
      {/* Cart Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Current Order</h3>
          <p className="text-xs text-zinc-500">{items.length} items</p>
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearCart} className="text-red-400 hover:text-red-300">
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <ShoppingCartEmpty />
            <p className="text-sm mt-3">Cart is empty</p>
            <p className="text-xs text-zinc-600 mt-1">Add items to get started</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">
                  {item.name}
                </p>
                <p className="text-xs text-zinc-500 tabular-nums">
                  ${item.price.toFixed(2)} each
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-8 text-center text-sm font-semibold text-zinc-200 tabular-nums">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <p className="text-sm font-semibold text-zinc-100 tabular-nums w-16 text-right">
                ${(item.price * item.quantity).toFixed(2)}
              </p>
              <button
                onClick={() => removeItem(item.productId)}
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Payment Section */}
      <div className="border-t border-zinc-800 p-5 space-y-4 bg-zinc-900/30">
        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Subtotal</span>
            <span className="text-zinc-200 tabular-nums">${getTotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Tax (16%)</span>
            <span className="text-zinc-200 tabular-nums">${getTax().toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-zinc-800 pt-2">
            <span className="text-base font-semibold text-zinc-100">Total</span>
            <span className="text-xl font-bold text-gold tabular-nums">
              ${getGrandTotal().toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "card", icon: CreditCard, label: "Card" },
            { id: "cash", icon: Banknote, label: "Cash" },
            { id: "mobile", icon: Smartphone, label: "M-Pesa" },
          ].map((method) => (
            <button
              key={method.id}
              onClick={() => setPaymentMethod(method.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-3 transition-all duration-200",
                paymentMethod === method.id
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              )}
            >
              <method.icon className="h-4 w-4" />
              <span className="text-[10px] font-medium">{method.label}</span>
            </button>
          ))}
        </div>

        {/* Checkout Button */}
        <Button
          size="xl"
          className="w-full"
          disabled={items.length === 0}
          onClick={handleCheckout}
        >
          Complete Sale · ${getGrandTotal().toFixed(2)}
        </Button>
      </div>
    </div>
  );
}

function ShoppingCartEmpty() {
  return (
    <svg
      className="h-16 w-16 opacity-30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 2h3.5l2.7 12.4a2 2 0 002 1.6h7.7a2 2 0 002-1.6l1.6-8.4H7.1" />
      <circle cx="10.5" cy="21" r="1" />
      <circle cx="17.5" cy="21" r="1" />
    </svg>
  );
}
