(function () {
  window.PlatformApiPlaceholders = {
    foodpanda: {
      webhookPath: "/api/platforms/foodpanda/webhook",
      verifySignature: function () {
        throw new Error("Foodpanda webhook verification not implemented yet.");
      },
      handleWebhookPayload: function () {
        throw new Error("Foodpanda webhook handler not implemented yet.");
      }
    },
    ubereats: {
      pollingPath: "/api/platforms/ubereats/orders",
      fetchOrders: function () {
        throw new Error("Uber Eats API polling is not implemented yet.");
      },
      syncOrders: function () {
        throw new Error("Uber Eats order sync is not implemented yet.");
      }
    }
  };
})();
