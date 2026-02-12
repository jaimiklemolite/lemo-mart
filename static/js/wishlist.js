let wishlistSet = new Set();

function toggleWishlist(btn) {
  const productId = btn.dataset.productId;

  if (!productId) {
    console.error("Wishlist error: productId missing");
    return;
  }

  fetch("/api/users/profile", { credentials: "include" })
    .then(res => {
      if (!res.ok) {
        showConfirm(
          "Login Required",
          "You must login to use wishlist. Go to login page?",
          () => {
            localStorage.setItem("pendingWishlistProduct", productId);
            showToast("Please Login To Continue", "info", 3000, true);
            window.location.href = "/login";
          }
        );
        return Promise.reject("GUEST_CONFIRM");
      }
    })

    .then(() => {
      const isActive = btn.classList.contains("active");

      const url = isActive
        ? `/api/users/wishlist/remove/${productId}`
        : `/api/users/wishlist/add/${productId}`;

      return fetch(url, {
        method: isActive ? "DELETE" : "POST",
        credentials: "include"
      });
    })

    .then(res => res.json())
    .then(data => {
      if (!data || !data.product_id) return;

      const wasActive = btn.classList.contains("active");

      btn.classList.toggle("active");

      const icon = btn.querySelector("i");
      const text = btn.querySelector(".wishlist-text");
      const isProductDetails = btn.dataset.context === "product-details";

      if (icon) {
        icon.classList.toggle("fa-regular");
        icon.classList.toggle("fa-solid");
      }

      const isNowActive = btn.classList.contains("active");

      if (isProductDetails && text) {
        if (isNowActive) {
          text.textContent = "Added to Wishlist";
          btn.classList.add("added");
        } else {
          text.textContent = "Add to Wishlist";
          btn.classList.remove("added");
        }
      }

      if (isNowActive) {
        showToast("Product Added To Your Wishlist", "success");
      } else {
        showToast("Product Removed From Your Wishlist", "info");
      }

      if (typeof updateWishlistCount === "function") {
        updateWishlistCount();
      }

      if (!isNowActive && location.pathname === "/wishlist") {
        loadWishlistPage();
      }
    })

    .catch(err => {
      if (err === "GUEST_CONFIRM") return;
      showToast("Wishlist action failed", "error");
    });
}

function loadWishlistHearts() {
  fetch("/api/users/wishlist", { credentials: "include" })
    .then(res => {
      if (res.status === 401) return null;
      return res.json();
    })
    .then(data => {
      if (!data || !data.products) return;

      wishlistSet = new Set(data.products.map(p => p.id));

      document.querySelectorAll(".wishlist-btn").forEach(btn => {
        if (wishlistSet.has(btn.dataset.productId)) {
          btn.classList.add("active");
          btn.querySelector("i")
            .classList.replace("fa-regular", "fa-solid");
        }
      });
    })
    .catch(() => {});
}

function loadWishlistPage() {
  fetch("/api/users/wishlist", { credentials: "include" })
    .then(res => {
      if (res.status === 401) {
        document.getElementById("products").innerHTML =
          "<p>Your wishlist is empty</p>";
        return null;
      }
      return res.json();
    })
    .then(data => {
      const container = document.getElementById("products");
      if (!container) return;

      if (!data || !data.products || !data.products.length) {
        document.getElementById("wishlistEmptyState").style.display = "block";
        container.style.display = "none";
        return;
      }
      
      const normalized = data.products.map(p => ({
        ...p,
        _id: p.id
      }));

      document.getElementById("wishlistEmptyState").style.display = "none";
      container.style.display = "grid";

      renderProducts(normalized, false, false);

      document.querySelectorAll(".wishlist-btn").forEach(btn => {
        btn.classList.add("active");
        const icon = btn.querySelector("i");
        if (icon) {
          icon.classList.remove("fa-regular");
          icon.classList.add("fa-solid");
        }
      });
    })
    .catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => {
  loadWishlistHearts();
  if (location.pathname === "/wishlist") {
    loadWishlistPage();
  }
});
