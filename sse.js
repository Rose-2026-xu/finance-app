// SSE client management - separate module to avoid circular dependencies

const sseClients = new Set();

function broadcastEvent(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(data);
    } catch (err) {
      sseClients.delete(client);
    }
  });
}

function addSSEClient(res) {
  sseClients.add(res);
  return sseClients.size;
}

function removeSSEClient(res) {
  sseClients.delete(res);
  return sseClients.size;
}

module.exports = { broadcastEvent, addSSEClient, removeSSEClient };
