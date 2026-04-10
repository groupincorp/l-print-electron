"use client";
import { useCallback, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SocketClient } from "@/lib/socket-client";

function getSamplePrintData(inputPrinterName?: string) {
  const options = {
    printer_name: inputPrinterName,
    type: "product_lot",
    size: "big",
  };
  const contents = [
    {
      lotNumber: "LOT-2025-0042",
      expirationDate: "2026-12-31",
      sku: "SKU-8809253649255",
      lotId: "3af64575-8a9c-452e-8004-17e4fd921277",
      price: "$9.99",
      manufacturingDate: "2025-01-15",
    },
  ];
  return { contents, options };
}

export function TestPrintProductLot() {
  const [input, setInput] = useState("");
  const handlePrintTest = useCallback(async () => {
    const { contents, options } = getSamplePrintData(input);
    const socket = new SocketClient();
    socket.send(
      JSON.stringify({
        printer_info: options,
        content: contents,
      }),
    );
  }, [input]);

  return (
    <div className="flex flex-row gap-2 items-center">
      <Input
        value={input}
        placeholder="Enter printer name to test"
        onChange={(e) => setInput(e.target.value)}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrintTest}
        className="text-black "
      >
        Print Product Lot Test
      </Button>
    </div>
  );
}
