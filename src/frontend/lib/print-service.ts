import { requestDatabase } from "@/server/request-api";
import type { PosPrintData, PosPrintOptions } from "electron-pos-printer";

export class PrintService {
  private printerOption: PosPrintOptions;
  private isProcessing: boolean = false;

  constructor(option: PosPrintOptions) {
    this.printerOption = option;
  }

  async print(id: number, data: PosPrintData[]) {
    if (this.isProcessing) {
      console.warn(`Print job ${id} already processing, skipping duplicate`);
      return false;
    }

    this.isProcessing = true;

    try {
      console.log(`Starting print job ${id}`);
      const response = await backend.printJob(data, this.printerOption);
      console.log("Print job response:", response);

      // Only remove from queue if print was successful
      if (response) {
        await requestDatabase("/api/print-queue/delete", "DELETE", {
          ids: [id],
        });
        console.log(`Successfully completed and removed print job ${id}`);
        return true;
      } else {
        console.warn(`Print job ${id} failed, keeping in queue`);
        return false;
      }
    } catch (error) {
      console.error(`Error in print job ${id}:`, error);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}
