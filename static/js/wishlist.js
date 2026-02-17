let wishlistSet = new Set();

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
