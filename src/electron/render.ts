/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-irregular-whitespace */
import { BrowserWindow } from "electron";
import {
  PosPrinter,
  type PosPrintData,
  type PosPrintOptions,
} from "electron-pos-printer";

export function printJob(
  data: {
    table: string;
    delivery: string;
    date: string;
    title: string;
    addon: string;
    remark: string;
    by: string;
  },
  printerName: string,
  mainWindow: BrowserWindow
) {
  const options: any = {
    preview: false,
    margin: "0 0 0 0",
    copies: 1,
    printerName,
    timeOutPerLine: 400,
    silent: true,
    pageSize: "80mm",
  };

  const content: any[] = [
    {
      type: "text",
      value: `តុលេខ=​ ${data.table}`,
      style: {
        fontSize: "20px",
        fontWeight: "bold",
        fontFamily: `Hanuman, 'Courier New', Courier, monospace`,
      },
    },
  ];

  if (data.delivery) {
    content.push({
      type: "text",
      value: "--------------------------------",
      style: { fontFamily: `Hanuman, 'Courier New', Courier, monospace` },
    });
    content.push({
      type: "text",
      value: `ដឹកជញ្ជូន= ${data.delivery}`,
      style: {
        fontSize: "18px",
        fontWeight: "bold",
        fontFamily: `Hanuman, 'Courier New', Courier, monospace`,
      },
    });
  }

  content.push({
    type: "text",
    value: "--------------------------------",
    style: { fontFamily: `Hanuman, 'Courier New', Courier, monospace` },
  });

  content.push({
    type: "text",
    value: `កាលបរិច្ឆេទ= ${data.date}`,
    style: {
      fontSize: "18px",
      fontWeight: "bold",
      fontFamily: `Hanuman, 'Courier New', Courier, monospace`,
    },
  });

  content.push({
    type: "text",
    value: "--------------------------------",
    style: { fontFamily: `Hanuman, 'Courier New', Courier, monospace` },
  });

  content.push({
    type: "text",
    value: `ទំនិញ= ${data.title}`,
    style: {
      fontSize: "18px",
      fontWeight: "bold",
      fontFamily: `Hanuman, 'Courier New', Courier, monospace`,
    },
  });

  if (data.addon) {
    content.push({
      type: "text",
      value: "--------------------------------",
      style: { fontFamily: `Hanuman, 'Courier New', Courier, monospace` },
    });
    content.push({
      type: "text",
      value: `Addon= ${data.addon}`,
      style: {
        fontSize: "18px",
        fontWeight: "bold",
        fontFamily: `Hanuman, 'Courier New', Courier, monospace`,
      },
    });
  }

  if (data.remark) {
    content.push({
      type: "text",
      value: "--------------------------------",
      style: { fontFamily: `Hanuman, 'Courier New', Courier, monospace` },
    });
    content.push({
      type: "text",
      value: `Remark= ${data.remark}`,
      style: {
        fontSize: "18px",
        fontWeight: "bold",
        fontFamily: `Hanuman, 'Courier New', Courier, monospace`,
      },
    });
  }

  content.push({
    type: "text",
    value: "--------------------------------",
    style: { fontFamily: `Hanuman, 'Courier New', Courier, monospace` },
  });

  content.push({
    type: "text",
    value: `បញ្ជាទិញដោយ= ${data.by}`,
    style: {
      fontSize: "18px",
      fontWeight: "bold",
      fontFamily: `Hanuman, 'Courier New', Courier, monospace`,
    },
  });

  PosPrinter.print(content, options)
    .then(() => {
      console.log("Printer successfully");
      mainWindow.webContents.send(
        "print-job",
        JSON.stringify({
          success: true,
          message:
            "Printer successfully -------------------------------------------------",
        })
      );
    })
    .catch((err) => {
      console.log("Failed to print", err);
      JSON.stringify({
        success: true,
        message:
          "Failed to print -------------------------------------------------",
      });
    });
}

export async function createPrintJob(
  data: PosPrintData[],
  option: PosPrintOptions
) {
  return await PosPrinter.print(data, option);
}
