let cachedUsers = [];
let cachedOrders = [];
let lastOrderUpdate = null;
let lastOrderCount = 0;
let pendingNewOrders = 0;
let usersNeedReload = false;
let ordersNeedReload = false;

function capitalizeFirstLetter(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// LOAD USERS AND TABLE
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
        <th>Orders</th>
        <th>Role</th>
      </tr>

      ${users.map(u => `
        <tr>
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td><b>${u.role === "admin" ? "–" : u.order_count}</b></td>
          <td>${capitalizeFirstLetter(u.role)}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

// LOAD & RENDER ORDERS
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

    cachedOrders = sortOrdersByDate(data.orders);
    lastOrderCount = cachedOrders.length;
    populateOrderCategoryFilter(); 
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
          <p><strong>Order ID:</strong> ${order.order_number}</p>
          <p><strong>Username:</strong> ${order.username}</p>
          <p><strong>Customer Email:</strong> ${order.customer_email}</p>
          <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
          <p><strong>Total Items:</strong> ${order.total_items}</p>
          <p class="admin-order-total" style="font-weight: 500;color: #0f766e;">
            <strong>Order Total:</strong> ₹${order.order_total?.toLocaleString("en-IN") || 0}
          </p>
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
              <p class="admin-product-category">
                ${titleCase(item.category || "Unknown")}
              </p>
              <p>Qty: ${item.qty}</p>
              <p class="price">₹${item.price?.toLocaleString("en-IN") || 0}</p>
            </div>
          </div>
        `).join("")}
      </div>

    </div>
  `).join("");
}

// FILTER BY STATUS, COUNT, DATE CREATED FOR ORDERS
function filterOrdersByStatus() {
  filterOrdersByCategory();
}

function updateOrderCount(orders) {
  const el = document.getElementById("orderCount");
  if (!el) return;
  el.innerText = `Order(s) Found: ${orders.length}`;
}

function sortOrdersByDate(orders) {
  return [...orders].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

// ORDER STATUS CONTROL & UPDATE
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

function filterOrdersByCategory() {
  const selectedCategory =
    document.getElementById("orderCategoryFilter").value;

  const selectedStatus =
    document.getElementById("orderStatusFilter").value;

  let filtered = [...cachedOrders];

  if (selectedStatus !== "All") {
    filtered = filtered.filter(o => o.status === selectedStatus);
  }

  if (selectedCategory !== "All") {
    filtered = filtered.filter(order =>
      order.items.some(item => item.category === selectedCategory)
    );
  }

  renderOrders(filtered);
  updateOrderCount(filtered);
}

function populateOrderCategoryFilter() {
  const select = document.getElementById("orderCategoryFilter");
  if (!select) return;

  fetch("/api/categories", { credentials: "include" })
    .then(res => res.json())
    .then(categories => {

      select.innerHTML = `<option value="All">All Categories</option>`;

      categories.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.name;
        option.textContent = titleCase(cat.name);
        select.appendChild(option);
      });

    })
    .catch(() => console.error("Failed to load categories for order filter"));
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
    setTimeout(filterOrdersByCategory, 50);
  });
}

function checkAdminOrderChanges() {
  fetch("/api/orders/last-update", { credentials: "include" })
    .then(res => res.json())
    .then(data => {

      if (!lastOrderUpdate) {
        lastOrderUpdate = data.last_update;
        return;
      }

      if (data.last_update !== lastOrderUpdate) {
        lastOrderUpdate = data.last_update;

        fetch("/api/orders/all", { credentials: "include" })
          .then(res => res.json())
          .then(newData => {

            const newCount = (newData.orders || []).length;

            if (newCount > lastOrderCount) {

              const diff = newCount - lastOrderCount;
              pendingNewOrders += diff;

              ordersNeedReload = true;
              usersNeedReload = true;

              const ordersTabVisible =
                !document.getElementById("ordersSection")
                  ?.classList.contains("hidden");
              const usersTabVisible =
                !document.getElementById("usersSection")
                  ?.classList.contains("hidden");

              if (ordersTabVisible) {
                loadOrders();
                if (pendingNewOrders === 1) {
                  showToast("New Order Received", "info");
                } else {
                  showToast("New Orders Received", "info");
                }
                pendingNewOrders = 0;
                ordersNeedReload = false;
                updateOrdersBadge();
              }

              if (usersTabVisible) {
                loadUsers();
                usersNeedReload = false;
              }

              if (!ordersTabVisible) {
                updateOrdersBadge();
              }
            }
            lastOrderCount = newCount;
          });
      }
    })
    .catch(() => {});
}

function updateOrdersBadge() {
  const badge = document.getElementById("ordersBadge");
  if (!badge) return;

  if (pendingNewOrders > 0) {
    badge.textContent = pendingNewOrders;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (location.pathname === "/admin/dashboard") {
    fetch("/api/orders/all", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        lastOrderCount = (data.orders || []).length;
      });

    setInterval(checkAdminOrderChanges, 5000);
  }
});
