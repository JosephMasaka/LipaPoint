import { Header } from "@/components/header";
import { InventoryManager } from "@/components/inventory-manager";

export default async function InventoryPage() {
  return (
    <div className="flex flex-col">
      <Header title="Inventory" subtitle="Manage products and stock levels" />
      <div className="p-6">
        <InventoryManager />
      </div>
    </div>
  );
}
