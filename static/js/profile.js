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
  const currentPlan = (data.membership?.plan || "free").toLowerCase();
  updateMembershipButtons(currentPlan);

  const profileInfo = document.getElementById("profileInfo");
  if (profileInfo) {
    profileInfo.innerHTML = `
      <p><b>Username:</b> ${user.username || "-"}</p>
      <p><b>Email:</b> ${user.email}</p>
      <p><b>Membership:</b>
        <span id="membershipText">
          ${(data.membership?.plan || "free").toUpperCase()}
        </span>
      </p>
      ${
        data.membership?.expires_at
        ? (() => {

            const expiry = new Date(data.membership.expires_at);

            if (isNaN(expiry.getTime())) return "";

            const formatted = expiry.toLocaleDateString("en-IN",{
              day:"2-digit",
              month:"short",
              year:"numeric"
            });

            return `<p class="membership-expiry">
                      <b>Valid Until:</b> ${formatted}
                    </p>`;
        })()
        : ""
      }
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
          <p>• ${item.name} × ${item.qty} (₹${(item.price_at_purchase ?? item.price ?? 0).toLocaleString("en-IN")})</p>
        `).join("")}
      </div>

      <p><strong>Total Items:</strong> ${order.total_items}</p>
      <p class="order-total" style="font-weight:500;color:#0f766e;">
        <strong>Order Total:</strong>
        ₹${order.order_total?.toLocaleString("en-IN") || 0}
      </p>
    </div>
  `).join("");
});

function updateMembershipButtons(currentPlan){
  const buttons = document.querySelectorAll(".membership-btn");
  buttons.forEach(btn => {

    const plan = btn.dataset.plan;
    const card = btn.closest(".membership-card");

    if(plan === currentPlan){
      btn.textContent = "Active";
      btn.disabled = true;
      btn.classList.add("membership-disabled");

      if(card){
        card.classList.add("membership-active");
      }
    }else{
      btn.textContent =
        "Buy " + plan.charAt(0).toUpperCase() + plan.slice(1);

      btn.disabled = false;
      btn.classList.remove("membership-disabled");

      if(card){
        card.classList.remove("membership-active");
      }
    }
  });
}

function buyMembership(plan){
  fetch("/api/membership/buy",{
    method:"POST",
    credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({plan})
  })
  .then(res=>res.json())
  .then(data=>{

    if(!data || data.error){
      showToast("Membership Purchase Failed","error");
      return;
    }
    showToast("Membership Activated Successfully","success");

    const membershipText = document.getElementById("membershipText");
    if(membershipText){
      membershipText.textContent = plan.toUpperCase();
    }
    updateMembershipButtons(plan);
  })
  .catch(()=>{
    showToast("Membership Purchase Failed","error");
  });
}
