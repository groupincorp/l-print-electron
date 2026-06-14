import type { PosPrintData } from "electron-pos-printer";
import { useCallback, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

function getSamplePrintData() {
  const options = {
    preview: false, // Preview in window or print
    margin: "0 0 0 0", // margin of content body
    copies: 1, // Number of copies to print
    printerName: "", // printerName: string, check it at webContent.getPrinters()
    timeOutPerLine: 400,
    silent: true,
    pageSize: "80mm",
  };

  const data: PosPrintData[] = [
    {
      type: "text",
      style: {
        fontSize: "20px",
        fontFamily: "Hanuman, 'Courier New', Courier, monospace",
        fontWeight: "bold",
      },
      value: "តុលេខ: T-02",
    },
    {
      type: "text",
      style: {
        fontSize: "18px",
        fontFamily: "Hanuman, 'Courier New', Courier, monospace",
        fontWeight: "bold",
      },
      value: "កាលបរិច្ឆេទ: 2025-09-16 00:02:26",
    },
    {
      type: "text",
      style: {
        fontSize: "18px",
        fontFamily: "Hanuman, 'Courier New', Courier, monospace",
        fontWeight: "bold",
      },
      value: "បញ្ជាទិញដោយ: owner",
    },
    {
      type: "text",
      style: { fontFamily: "Hanuman, 'Courier New', Courier, monospace" },
      value: "--------------------------------",
    },
    {
      type: "text",
      style: {
        fontSize: "18px",
        fontFamily: "Hanuman, 'Courier New', Courier, monospace",
        fontWeight: "bold",
        whiteSpace: "pre-wrap",
        width: "257px",
        display: "block",
        wordBreak: "break-word",
      },
      value:
        "ទំនិញ: នំក្រែមវ៉ាន់នីឡា Stikko Fingers Milk Vanilla (28g x 12) x 4",
    },
    {
      type: "text",
      style: {
        fontSize: "18px",
        fontFamily: "Hanuman, 'Courier New', Courier, monospace",
        fontWeight: "bold",
      },
      value: "   + Milkshake",
    },
    {
      type: "text",
      style: {
        fontSize: "18px",
        fontFamily: "Hanuman, 'Courier New', Courier, monospace",
        fontWeight: "bold",
      },
      value: "   + Mozzarella",
    },
    {
      type: "text",
      style: {
        fontSize: "18px",
        fontFamily: "Hanuman, 'Courier New', Courier, monospace",
        fontWeight: "bold",
      },
      value: "   + Cheddar",
    },
    {
      type: "text",
      style: {
        fontSize: "18px",
        fontFamily: "Hanuman, 'Courier New', Courier, monospace",
        fontWeight: "bold",
      },
      value: "   + Need Ice",
    },
    {
      type: "text",
      style: { fontFamily: "Hanuman, 'Courier New', Courier, monospace" },
      value: "--------------------------------",
    },
    {
      type: "qrCode",
      style: {
        textAlign: "center",
        fontFamily: "Hanuman, 'Courier New', Courier, monospace",
        margin: "10 20px 20 20px",
      },
      value: "987caeb2-057b-4460-b573-ef22dc08b81c",
      width: "100",
      height: "100",
      fontsize: 12,
    },
  ];

  return { data, options };
}

export function PrintTestButton() {
  const [input, setInput] = useState("");
  const handlePrintTest = useCallback(async () => {
    const { data, options } = getSamplePrintData();
    const response = await backend.printJob(data, {
      ...options,
      printerName: input || options.printerName,
    });
    console.log("Print job response:", response);
  }, [input]);

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={input}
        placeholder="Printer name…"
        onChange={(e) => setInput(e.target.value)}
        className="h-8 text-[12px] w-36"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrintTest}
        className="h-8 text-[12px] flex-shrink-0"
      >
        Test Print
      </Button>
    </div>
  );
}
