import { requestDatabase } from "@/server/request-api";
import type { PosPrintData, PosPrintOptions } from "electron-pos-printer";

export class PrintService {
  private printerOption: PosPrintOptions;
  constructor(option: PosPrintOptions) {
    this.printerOption = option;
  }

  async print(id: number, data: PosPrintData[]) {
    const response = await backend.printJob(data, this.printerOption);
    console.log("Print job response:", response);

    // Remove successful job from queue
    await requestDatabase("/api/print-queue/delete", "DELETE", {
      ids: [id],
    });
  }
}
