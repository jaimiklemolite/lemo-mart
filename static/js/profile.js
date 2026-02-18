fetch("/api/users/profile", {
  credentials: "include"
})
.then(res => {
  if (!res.ok) {
    window.location.href = "/";
    return null;
  }
  return res.json();
})
.then(data => {
  if (!data) return;

  const { user, orders } = data;

  const profileInfo = document.getElementById("profileInfo");
  if (profileInfo) {
    profileInfo.innerHTML = `
      <p><b>Username:</b> ${user.username || "-"}</p>
      <p><b>Email:</b> ${user.email}</p>
    `;
  }

  if (user.role === "admin") return;

  const orderDiv = document.getElementById("orderHistory");
  if (!orderDiv) return;

  const recentOrders = (orders || [])
    .filter(o => ["Delivered", "Rejected", "Cancelled"].includes(o.status))
    .sort((a, b) => {
      if (a.status === "Delivered" && b.status === "Delivered") {
        return new Date(b.delivered_at || 0) - new Date(a.delivered_at || 0);
      }
      return new Date(b.status_updated_at || 0) - new Date(a.status_updated_at || 0);
    });
  
  if (!recentOrders.length) {
    orderDiv.innerHTML = "<p>No recent orders</p>";
    return;
  }

  orderDiv.innerHTML = recentOrders.map(order => `
    <div class="order-card">

      <div class="order-header">
        <span><b>Order ID:</b> ${order.order_number}</span>
        <span class="order-status ${order.status.toLowerCase().replace(/ /g, "-")}">
          ${order.status}
        </span>
      </div>

      <div class="order-summary-items">
        ${order.items.map(item => `
          <p>• ${item.name} × ${item.qty} (₹${item.price?.toLocaleString("en-IN") || 0})</p>
        `).join("")}
      </div>
      <p><strong>Total Items:</strong> ${order.total_items}</p>
      <p class="order-total" style="font-weight: 500;color: #0f766e;">
        <strong>Order Total:</strong> ₹${order.order_total?.toLocaleString("en-IN") || 0}
      </p>
    </div>
  `).join("");
});
