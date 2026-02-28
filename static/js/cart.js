let lastQtyMap = {};

function loadCart() {
  fetch("/api/cart", { credentials: "include" })
    .then(res => {
      if (!res.ok) throw new Error("Cart load failed");
      return res.json();
    })
    .then(data => {
      const itemsDiv = document.getElementById("cartItems");
      const summaryDiv = document.getElementById("cartSummary");

      if (!data.items || data.items.length === 0) {
        document.getElementById("cartEmptyState").style.display = "block";
        itemsDiv.style.display = "none";
        summaryDiv.style.display = "none";
        lastQtyMap = {};
        return;
      }
      
      document.getElementById("cartEmptyState").style.display = "none";
      itemsDiv.style.display = "flex";
      summaryDiv.style.display = "block";

      let totalAmount = 0;

      itemsDiv.innerHTML = data.items.map(item => {
        const price = item.offer_price || item.price;
        const itemTotal = price * item.qty;
        totalAmount += itemTotal;

        const stock = item.stock ?? 9999;
        const prevQty = lastQtyMap[item.product_id];
        const animate = prevQty !== undefined && prevQty !== item.qty;
        lastQtyMap[item.product_id] = item.qty;

        return `
          <div class="cart-card">
            <div class="cart-image"
              style="background-image:url('${item.image_url || "/static/no-image.png"}')">
            </div>

            <div class="cart-info">
              <h4>${item.name}</h4>
              <div class="price">
                ${
                  item.offer_price
                    ? `
                      <span class="offer-price">
                        ₹${item.offer_price.toLocaleString("en-IN")}
                      </span>
                      <span class="original-price">
                        ₹${item.original_price.toLocaleString("en-IN")}
                      </span>
                      <span class="discount-badge">
                        ${item.discount_percent}% OFF
                      </span>
                    `
                    : `₹ ${item.price?.toLocaleString("en-IN") || 0}`
                }
              </div>

              <div class="cart-actions">
                <button
                  onclick="decreaseQty('${item.product_id}', ${item.qty})"
                  ${item.qty <= 1 ? "disabled" : ""}>
                  −
                </button>

                <span class="qty ${animate ? "qty-change" : ""}">
                  ${item.qty}
                </span>

                <button
                  onclick="increaseQty('${item.product_id}', ${item.qty}, ${stock})"
                  ${item.qty >= stock ? "disabled" : ""}>
                  +
                </button>
              </div>
            </div>

            <button class="remove-btn"
              onclick="removeFromCart('${item.product_id}')">
              Remove
            </button>
            <button class="remove-btn"
                    onclick="moveToWishlist('${item.product_id}')">
              Move to Wishlist
            </button>
          </div>
        `;
      }).join("");

      summaryDiv.style.display = "block";
      summaryDiv.innerHTML = `
        <h3>Cart Summary</h3>

        ${data.items.map(item => `
          <div class="cart-summary-item">
            <span>${item.name}</span>
            <span>₹ ${(item.offer_price || item.price).toLocaleString("en-IN")} × ${item.qty}</span>
          </div>
        `).join("")}

        <hr>

        <div class="cart-summary-item">
          <span>Amount</span>
          <span>₹ ${totalAmount?.toLocaleString("en-IN") || 0}</span>
        </div>

        <div class="cart-summary-total">
          <span>Total (Including Shipping)</span>
          <span>₹ ${totalAmount?.toLocaleString("en-IN") || 0}</span>
        </div>

        <button class="place-order-btn" onclick="placeOrder()">
          Place Order
        </button>
      `;
    });
}

function moveToWishlist(productId) {
  showConfirm(
    "Move Item To Wishlist",
    "Are you sure you want to remove the product from the cart and add to wishlist?",
    async () => {

      try {
        const removeRes = await fetch(`/api/cart/remove/${productId}`, {
          method: "DELETE",
          credentials: "include"
        });

        if (!removeRes.ok) throw new Error();

        const wishRes = await fetch(`/api/users/wishlist/add/${productId}`, {
          method: "POST",
          credentials: "include"
        });

        if (!wishRes.ok) throw new Error();

        await loadCart();
        updateCartCount();
        updateWishlistCount();

        showToast("Product Moved To Wishlist Successfully", "success");

      } catch (err) {
        showToast("Failed To Move Item To Wishlist", "error");
      }

    }
  );
}

function increaseQty(productId, currentQty, stock) {
  if (currentQty >= stock) return;

  fetch("/api/cart/update", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: productId,
      qty: currentQty + 1
    })
  })
  .then(res => {
    if (!res.ok) throw new Error("Update failed");
    return res.json();
  })
  .then(() => loadCart())
  .catch(() => showToast("Failed To Update Quantity", "error"));
}

function decreaseQty(productId, currentQty) {
  if (currentQty <= 1) return;

  fetch("/api/cart/update", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: productId,
      qty: currentQty - 1
    })
  })
  .then(res => {
    if (!res.ok) throw new Error("Update failed");
    return res.json();
  })
  .then(() => loadCart())
  .catch(() => showToast("Failed To Update Quantity", "error"));
}

function removeFromCart(productId) {
  showConfirm(
    "Remove Item From Cart",
    "Are you sure you want to remove this product from your cart?",
    () => {
      fetch(`/api/cart/remove/${productId}`, {
        method: "DELETE",
        credentials: "include"
      })
      .then(res => {
        if (!res.ok) throw new Error("Remove failed");
        return res.json();
      })
      .then(() => {
        showToast("Product Removed From Your Cart", "info");
        loadCart();
        updateCartCount();
      })
      .catch(() => showToast("Failed To Remove Product", "error"));
    }
  );
}

function placeOrder() {
  fetch("/api/orders/place", {
    method: "POST",
    credentials: "include"
  })
  .then(res => {
    if (!res.ok) {
      showToast("Failed To Place Order", "error");
      return;
    }
    showToast("Order Placed Successfully", "success", 3000, true);
    window.location.href = "/orders";
  });
}

window.addEventListener("load", loadCart);
