// Utility functions to replace localStorage with electron-store

export const electronStore = {
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await backend.store.get(key);
      return value ?? null;
    } catch (error) {
      console.error('Error getting item from store:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await backend.store.set(key, value);
    } catch (error) {
      console.error('Error setting item in store:', error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await backend.store.delete(key);
    } catch (error) {
      console.error('Error removing item from store:', error);
    }
  },

  async clear(): Promise<void> {
    try {
      await backend.store.clear();
    } catch (error) {
      console.error('Error clearing store:', error);
    }
  }
};