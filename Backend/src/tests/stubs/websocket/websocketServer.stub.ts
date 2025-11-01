// Stub for '@/websocket/websocketServer' used in websocket-focused tests
// Provides a minimal, test-friendly interface matching common project imports.

export type WebSocketMessage = {
  type: string;
  payload: unknown;
  timestamp: Date;
};

class WebSocketServerStub {
  public clients: Set<string> = new Set();
  public on = (_event: string, _handler: (...args: any[]) => void) => {
    // No-op in stub; tests can spy on this if needed
  };

  // Legacy/simple broadcast expected by some tests
  public broadcast(event: string, payload: any) {
    // No-op; tests will spy on this method via vi.mock
  }

  // Methods used by services to broadcast structured messages
  public broadcastToRoom(room: string, message: WebSocketMessage) {
    // No-op; record usage if necessary in future
  }

  public broadcastToAll(message: WebSocketMessage) {
    // No-op
  }

  public broadcastToUser(userId: string, message: WebSocketMessage) {
    // No-op
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }

  public getRoomSubscribers(_room: string): number {
    return 0;
  }

  public isUserConnected(_userId: string): boolean {
    return false;
  }

  public getStatus() {
    return {
      initialized: true,
      connectedClients: this.getConnectedClients(),
      rooms: {},
    };
  }
}

export const websocketServer = new WebSocketServerStub();
export const webSocketManager = websocketServer;
export default websocketServer;