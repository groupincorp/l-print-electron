/**
 * Simple in-memory lock mechanism to prevent duplicate print job processing
 */
class PrintLock {
  private locks = new Set<number>();

  /**
   * Try to acquire a lock for a print job
   * @param jobId - The ID of the print job
   * @returns true if lock was acquired, false if already locked
   */
  tryLock(jobId: number): boolean {
    if (this.locks.has(jobId)) {
      return false;
    }
    this.locks.add(jobId);
    return true;
  }

  /**
   * Release a lock for a print job
   * @param jobId - The ID of the print job
   */
  release(jobId: number): void {
    this.locks.delete(jobId);
  }

  /**
   * Check if a job is currently locked
   * @param jobId - The ID of the print job
   * @returns true if locked, false otherwise
   */
  isLocked(jobId: number): boolean {
    return this.locks.has(jobId);
  }

  /**
   * Get all currently locked job IDs
   * @returns Array of locked job IDs
   */
  getLockedJobs(): number[] {
    return Array.from(this.locks);
  }

  /**
   * Clear all locks (use with caution)
   */
  clearAll(): void {
    this.locks.clear();
  }
}

// Export a singleton instance
export const printLock = new PrintLock();
