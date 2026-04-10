export class SocketClient {
  static connection: WebSocket | null = null;
  static queue: string | null = null;

  constructor() {
    if (SocketClient.connection === null) {
      SocketClient.connection = this.createWebSocket();
    }
  }

  public send(message: string) {
    console.log(message, SocketClient.connection);

    if (SocketClient.connection === null) {
      SocketClient.queue = message;
      SocketClient.connection = this.createWebSocket();
      return;
    }

    if (SocketClient.connection.readyState === SocketClient.connection.OPEN) {
      SocketClient.connection.send(message);
    } else {
      SocketClient.queue = message;
    }
  }

  private createWebSocket() {
    const ws = new WebSocket("ws://127.0.0.1:8181");

    ws.onerror = () => {
      SocketClient.connection = null;
    };

    ws.onclose = () => {
      SocketClient.connection = null;
    };

    ws.onopen = () => {
      if (SocketClient.queue !== null) {
        ws.send(SocketClient.queue);
        SocketClient.queue = null;
      }
    };

    return ws;
  }
}
