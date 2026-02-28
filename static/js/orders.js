let cachedOrders = [];
let lastUserOrderUpdate = null;

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("ordersContainer");
  if (!container) return;

  loadOrders(container);
  setInterval(checkUserOrderChanges, 5000);
});

function loadOrders(container) {
  fetch("/api/users/profile", { credentials: "include" })
  .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (!data) return;

      cachedOrders = (data.orders || []).filter(o => o.status !== "Cancelled");
      cachedOrders = sortOrdersForUser(cachedOrders);
      renderOrders(container, cachedOrders);
      updateOrderCount(cachedOrders);
    });
}

function filterOrdersByStatus() {
  const status = document.getElementById("orderStatusFilter").value;
  const search = (document.getElementById("orderSearch")?.value || "").toLowerCase();

  let filtered = [...cachedOrders];

  if (status !== "All") {
    filtered = filtered.filter(o => o.status === status);
  }

  if (search) {
    filtered = filtered.filter(order =>
      order.id.toLowerCase().includes(search) ||
      order.items.some(item => item.name.toLowerCase().includes(search)) ||
      order.items.some(item => item.category.toLowerCase().includes(search))
    );
  }

  renderOrders(document.getElementById("ordersContainer"), filtered);
  updateOrderCount(filtered);
}

function updateOrderCount(orders) {
  const el = document.getElementById("orderCount");
  if (!el) return;

  el.innerText = `Order(s) Found: ${orders.length}`;
}

function sortOrdersForUser(orders) {
  return [...orders].sort((a, b) => {

    if (a.status === "Delivered" && b.status === "Delivered") {
      return new Date(b.delivered_at || 0) - new Date(a.delivered_at || 0);
    }

    const priority = {
      "Pending": 1,
      "Approved": 2,
      "Out for Delivery": 3,
      "Delivered": 4,
      "Rejected": 5
    };

    const pA = priority[a.status] ?? 99;
    const pB = priority[b.status] ?? 99;

    if (pA !== pB) return pA - pB;

    return new Date(b.status_updated_at || 0) - new Date(a.status_updated_at || 0);
  });
}

function renderOrders(container, orders) {
  if (!orders.length) {
    container.innerHTML = "<p>No orders found...!</p>";
    return;
  }

  container.innerHTML = orders.map(order => {
    const progress = getProgress(order.status);
    const statusClass = getStatusClass(order.status);

    return `
      <div class="order-group ${statusClass}">

        <div class="order-header">
          <span><b>Order ID:</b> ${order.order_number}</span>
          <span class="order-status">${order.status}</span>
        </div>

        <div class="order-items-grid">
          ${order.items.map(item => `
            <div class="order-item-box">
              <div class="order-image"
                style="background-image:url('${item.image_url || "/static/no-image.png"}')">
              </div>

              <div class="order-info">
                <h4>${item.name}</h4>
                <p class="admin-product-category">
                  ${titleCase(item.category || "Unknown")}
                </p>
                <p>Qty: ${item.qty}</p>
                <p>₹${item.price_at_purchase?.toLocaleString("en-IN") || 0}</p>
              </div>
            </div>
          `).join("")}
        </div>

        <div class="order-status-row">
          <div>
            <div class="order-summary">
              <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
              <p><strong>Total Items:</strong> ${order.total_items}</p>
              <p class="order-total" style="font-weight: 500;color: #0f766e;">
                <strong>Order Total:</strong> ₹${order.order_total?.toLocaleString("en-IN") || 0}
              </p>
            </div>
            <div class="order-status-label">
              Order Status: ${order.status}
            </div>

            ${
              !["Delivered", "Rejected"].includes(order.status)
                ? `
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:${progress}%"></div>
                  </div>
                `
                : `
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:100%"></div>
                  </div>
                `
            }
          </div>

          ${
            ["Pending", "Approved"].includes(order.status)
              ? `
                <button class="dashboard-btn cancel-btn"
                  onclick="cancelOrder('${order.id}')">
                  Cancel Order
                </button>
              `
              : ""
          }
        </div>

      </div>
    `;
  }).join("");
}

function cancelOrder(orderId) {
  showConfirm(
    "Cancel Order",
    "Are you sure you want to cancel this order?",
    () => {
      fetch(`/api/orders/cancel/${orderId}`, {
        method: "PUT",
        credentials: "include"
      })
      .then(res => res.json())
      .then(() => {
        showToast("Order Cancelled Successfully", "error");
        const container = document.getElementById("ordersContainer");
        if (container) {
          loadOrders(container);
        }
      });
    }
  );
}

function checkUserOrderChanges() {
  fetch("/api/orders/user-last-update", { credentials: "include" })
    .then(res => res.json())
    .then(data => {

      if (!lastUserOrderUpdate) {
        lastUserOrderUpdate = data.last_update;
        return;
      }

      if (data.last_update !== lastUserOrderUpdate) {
        lastUserOrderUpdate = data.last_update;

        const container = document.getElementById("ordersContainer");
        if (container) {
          loadOrders(container);
          showToast("Order Status Updated", "info");
        }
      }
    })
    .catch(() => {});
}

function getStatusClass(status) {
  switch (status) {
    case "Pending": return "status-pending";
    case "Approved": return "status-approved";
    case "Out for Delivery": return "status-out";
    case "Delivered": return "status-delivered";
    case "Rejected": return "status-rejected";
    default: return "";
  }
}

function getProgress(status) {
  switch (status) {
    case "Pending": return 25;
    case "Approved": return 50;
    case "Out for Delivery": return 75;
    case "Delivered": return 100;
    case "Rejected": return 100;
    default: return 0;
  }
}
