"use client";

import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={() => toast.success("Order completed successfully!")}
        variant="default"
      >
        Success Toast
      </Button>

      <Button
        onClick={() => toast.error("Payment failed. Please try again.")}
        variant="destructive"
      >
        Error Toast
      </Button>

      <Button
        onClick={() => toast.info("New update available for download.")}
        variant="outline"
      >
        Info Toast
      </Button>

      <Button
        onClick={() => toast.warning("Low stock alert for Product XYZ.")}
        variant="outline"
      >
        Warning Toast
      </Button>

      <Button
        onClick={() => toast.success("This will stay for 10 seconds!", 10000)}
        variant="outline"
      >
        Custom Duration (10s)
      </Button>
    </div>
  );
}
