let cachedUsers = [];
let cachedOrders = [];

function loadUsers() {
  fetch("/api/users/admin/users", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      cachedUsers = data.users || [];

      renderUsersTable(cachedUsers);
    });
}

function renderUsersTable(users) {
  const usersDiv = document.getElementById("users");
  if (!usersDiv) return;

  usersDiv.innerHTML = `
    <table>
      <tr>
        <th>Username</th>
        <th>Email</th>
        <th>Role</th>
      </tr>

      ${users.map(u => `
        <tr>
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td>${capitalizeFirstLetter(u.role)}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

function capitalizeFirstLetter(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function loadOrders() {
  fetch("/api/orders/all", {
    credentials: "include"
  })
  .then(res => res.json())
  .then(data => {
    const ordersDiv = document.getElementById("adminOrders");
    if (!ordersDiv) return;

    if (!data.orders || !data.orders.length) {
      ordersDiv.innerHTML = "<p>No orders available</p>";
      return;
    }

    cachedOrders = sortOrdersSmartly(data.orders);
    renderOrders(cachedOrders);
    updateOrderCount(cachedOrders);
  });
}

function renderOrders(orders) {
  const ordersDiv = document.getElementById("adminOrders");
  if (!ordersDiv) return;

  if (!orders || !orders.length) {
    ordersDiv.innerHTML = "<p>No orders available for this status...!</p>";
    return;
  }

  ordersDiv.innerHTML = orders.map(order => `
    <div class="admin-order-wrapper">

      <div class="admin-order-left">
        <div class="admin-order-meta">
          <p><strong>Order ID:</strong> ${order.id}</p>
          <p><strong>Username:</strong> ${order.username}</p>
          <p><strong>Customer Email:</strong> ${order.customer_email}</p>
        </div>

        <div class="admin-order-divider"></div>

        <div class="admin-order-status-wrap">
          ${renderAdminStatusControl(order)}
        </div>
      </div>

      <div class="admin-order-products">
        ${order.items.map(item => `
          <div class="admin-product-card">
            <div class="admin-product-image"
              style="background-image:url('${item.image_url || "/static/no-image.png"}')">
            </div>

            <div class="admin-product-info">
              <h4>${item.name}</h4>
              <p>Qty: ${item.qty}</p>
              <p class="price">₹${item.price}</p>
            </div>
          </div>
        `).join("")}
      </div>

    </div>
  `).join("");
}

function filterOrdersByStatus() {
  const selectedStatus = document.getElementById("orderStatusFilter").value;

  if (selectedStatus === "All") {
    renderOrders(cachedOrders);
    updateOrderCount(cachedOrders);
    return;
  }

  const filtered = cachedOrders.filter(order => order.status === selectedStatus);
  renderOrders(filtered);
  updateOrderCount(filtered);
}

function updateOrderCount(orders) {
  const el = document.getElementById("orderCount");
  if (!el) return;

  el.innerText = `Order(s) Found: ${orders.length}`;
}

function sortOrdersSmartly(orders) {
  return [...orders].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

function renderAdminStatusControl(order) {
  const STATUS_FLOW = {
    "Pending": ["Approved", "Rejected"],
    "Approved": ["Out for Delivery", "Rejected"],
    "Out for Delivery": ["Delivered"],
    "Delivered": [],
    "Rejected": []
  };

  const allStatuses = [
    "Pending",
    "Approved",
    "Out for Delivery",
    "Delivered",
    "Rejected"
  ];

  if (["Delivered", "Rejected", "Cancelled"].includes(order.status)) {
    return `
      <span class="order-status-badge ${order.status.toLowerCase().replace(/\s/g, "-")}">
        ${order.status}
      </span>
    `;
  }

  const allowedNext = STATUS_FLOW[order.status] || [];

  return `
    <select class="admin-status-select"
      onchange="updateOrderStatus('${order.id}', this.value)">
      ${allStatuses.map(status => {
        const isCurrent = status === order.status;
        const isAllowed = allowedNext.includes(status);
        const disabled = !isCurrent && !isAllowed;

        return `
          <option value="${status}"
            ${isCurrent ? "selected" : ""}
            ${disabled ? "disabled" : ""}>
            ${status}
          </option>
        `;
      }).join("")}
    </select>
  `;
}

function updateOrderStatus(orderId, status) {
  fetch(`/api/orders/update-status/${orderId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  })
  .then(() => {
    loadOrders();
    setTimeout(filterOrdersByStatus, 50);
  });
}

window.addEventListener("load", () => {
  loadUsers();
  loadOrders();
});
