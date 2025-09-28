import {
  PosPrinter,
  type PosPrintData,
  type PosPrintOptions,
} from "electron-pos-printer";

export async function createPrintJob(
  data: PosPrintData[],
  option: PosPrintOptions
) {
  return await PosPrinter.print(data, option);
}
