// SSE connection manager for real-time updates

let eventSource: EventSource | null = null;
let listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

export function connectSSE() {
  if (eventSource) return;

  eventSource = new EventSource('/api/events');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const type = data.type;

      // Notify all listeners for this event type
      const typeListeners = listeners.get(type);
      if (typeListeners) {
        typeListeners.forEach(fn => fn(data));
      }

      // Notify wildcard listeners
      const wildcardListeners = listeners.get('*');
      if (wildcardListeners) {
        wildcardListeners.forEach(fn => fn(data));
      }
    } catch (err) {
      // Ignore parse errors
    }
  };

  eventSource.onerror = () => {
    // Reconnect after 3 seconds
    disconnectSSE();
    setTimeout(connectSSE, 3000);
  };
}

export function disconnectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

export function onSSEEvent(type: string, callback: (...args: any[]) => void) {
  if (!listeners.has(type)) {
    listeners.set(type, new Set());
  }
  listeners.get(type)!.add(callback);

  // Return unsubscribe function
  return () => {
    listeners.get(type)?.delete(callback);
  };
}
