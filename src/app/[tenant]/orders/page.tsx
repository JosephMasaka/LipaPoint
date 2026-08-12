import { Header } from "@/components/header";
import { OrdersTable } from "@/components/orders-table";

export default async function OrdersPage() {
  return (
    <div className="flex flex-col">
      <Header title="Orders" subtitle="Manage and track all orders" />
      <div className="p-6">
        <OrdersTable />
      </div>
    </div>
  );
}
