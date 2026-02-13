document.addEventListener("DOMContentLoaded", () => {
  const productId = document.body.dataset.productId;

  if (!productId) {
    console.error("❌ Product ID missing in body dataset");
    return;
  }

  loadProductDetails(productId);
  loadRelatedProducts(productId);
});

let CURRENT_STOCK = 0;

function titleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function loadProductDetails(productId) {
  fetch(`/api/products/${productId}`)
    .then(res => {
      if (!res.ok) throw new Error("Failed to load product details");
      return res.json();
    })
    .then(product => {

      const p = product;
      CURRENT_STOCK = p.quantity ?? 0;

      const stockLabel = document.getElementById("stockLabel");
      if (stockLabel) {
        if (CURRENT_STOCK > 0) {
          stockLabel.textContent = `In Stock (${CURRENT_STOCK})`;
          stockLabel.classList.remove("hidden", "out-of-stock");
          stockLabel.classList.add("in-the-stock");
        } else {
          stockLabel.textContent = "Out of Stock";
          stockLabel.classList.remove("hidden", "in-the-stock");
          stockLabel.classList.add("out-of-stock");
        }
      }

      document.getElementById("pd-name").textContent = p.name;
      document.getElementById("pd-price").textContent = `₹${p.price}`;
      document.getElementById("pd-description").textContent = p.description;
      document.getElementById("pd-category").textContent = titleCase(p.category);

      const mainImg = document.getElementById("pd-main-image");
      const leftBox = document.getElementById("pd-thumbs-left");
      const viewAll = document.getElementById("pd-view-all");

      const modal = document.getElementById("pd-gallery-modal");
      const modalMain = document.getElementById("pd-modal-main");
      const modalThumbs = document.getElementById("pd-modal-thumbs");
      const closeBtn = document.querySelector(".pd-close");

      const images = (p.images && p.images.length)
        ? p.images
        : ["/static/no-image.png"];

      if (mainImg) mainImg.src = images[0];

      if (leftBox) {
        leftBox.innerHTML = "";

        const maxVisible = 3;

        images.slice(0, maxVisible).forEach((img, i) => {
          const tile = document.createElement("div");
          tile.className = "thumb-tile";

          if (i === 0) tile.classList.add("active");

          const imgTag = document.createElement("img");
          imgTag.src = img;

          tile.appendChild(imgTag);

          tile.onmouseenter = () => {
            mainImg.src = img;

            document.querySelectorAll(".thumb-tile")
              .forEach(t => t.classList.remove("active"));

            tile.classList.add("active");
          };

          leftBox.appendChild(tile);
        });

        if (images.length > maxVisible) {
          const more = document.createElement("div");
          more.className = "thumb-tile thumb-more";

          const imgTag = document.createElement("img");
          imgTag.src = images[maxVisible];

          const overlay = document.createElement("span");
          overlay.textContent = `+${images.length - maxVisible}`;

          more.appendChild(imgTag);
          more.appendChild(overlay);

          more.onmouseenter = () => {
            mainImg.src = images[maxVisible];

            document.querySelectorAll(".thumb-tile")
              .forEach(t => t.classList.remove("active"));
          };

          more.onclick = () => viewAll.click();

          leftBox.appendChild(more);
        }
      }

      if (viewAll) {
        viewAll.style.display = images.length > 0 ? "block" : "none";
      }

      if (viewAll) {
        viewAll.onclick = () => {
          modal.style.display = "block";

          modalMain.src = images[0];

          document.getElementById("pd-modal-title").textContent = p.name;
          document.getElementById("pd-modal-desc").textContent = p.description;

          modalThumbs.innerHTML = images.map((img, i) => `
            <img src="${img}"
                class="${i === 0 ? "active" : ""}"
                onclick="
                  document.getElementById('pd-modal-main').src='${img}';
                  document.querySelectorAll('.pd-modal-thumbs-grid img')
                    .forEach(el => el.classList.remove('active'));
                  this.classList.add('active');
                ">
          `).join("");
        };
      }

      if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";

      if (modal) {
        modal.onclick = (e) => {
          if (e.target === modal) modal.style.display = "none";
        };
      }

      if (window.USER_ROLE !== "admin") {
        setupQuantityAndButtons(CURRENT_STOCK);
      }

      if (typeof loadWishlistHearts === "function") loadWishlistHearts();

      fetch("/api/users/wishlist", { credentials: "include" })
        .then(res => res.ok ? res.json() : null)
        .then(wishlist => {
          if (!wishlist?.products) return;

          const btn = document.getElementById("pdWishlistBtn");
          if (!btn) return;

          const isWishlisted = wishlist.products.some(
            item => item.id === productId
          );

          if (isWishlisted) {
            btn.classList.add("active", "added");

            const icon = btn.querySelector("i");
            const text = btn.querySelector(".wishlist-text");

            if (icon) {
              icon.classList.remove("fa-regular");
              icon.classList.add("fa-solid");
            }

            if (text) {
              text.textContent = "Product Added To Your Wishlist";
            }
          }
        });

      const specsContainer = document.getElementById("productSpecs");
      if (specsContainer && Array.isArray(p.specs) && p.specs.length) {
        specsContainer.innerHTML = `
          <table class="spec-table">
            <tr>
              <th>Category</th>
              <th>Specification</th>
            </tr>
            ${p.specs.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.value}</td>
              </tr>
            `).join("")}
          </table>
        `;
      }

      const nestedBox = document.getElementById("nestedDetails");
      if (nestedBox && Array.isArray(p.details)) {
        nestedBox.innerHTML = p.details.map((sec, i) => `
          <div class="nested-section">
            <div class="nested-header" onclick="toggleNested(${i})">
              <span>${sec.title}</span>
              <span id="nestedArrow-${i}">▶</span>
            </div>
            <div id="nestedBody-${i}" class="accordion-hidden">
              <ul>
                ${sec.content.map(line => `<li>${line}</li>`).join("")}
              </ul>
            </div>
          </div>
        `).join("");
      }
    })
    .catch(err => {
      console.error("❌ Product details error:", err);
    });
}

function switchProductImage(src, el) {
  const mainImg = document.getElementById("pd-main-image");
  if (mainImg) mainImg.src = src;

  document.querySelectorAll(".thumbs-vertical img")
    .forEach(i => i.classList.remove("active"));

  if (el) el.classList.add("active");
}

function setupQuantityAndButtons(stock) {
  const qtyWrapper = document.getElementById("qtyWrapper");
  const qtySelect = document.getElementById("qtySelect");
  const addBtn = document.getElementById("addToCartBtn");
  const continueBtn = document.getElementById("continueBtn");

  if (!qtyWrapper || !qtySelect || !addBtn || !continueBtn) return;

  if (stock > 0) {
    qtyWrapper.style.display = "block";
    addBtn.style.display = "inline-block";
    continueBtn.style.display = "none";

    qtySelect.innerHTML = "";

    for (let i = 1; i <= stock; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = String(i).padStart(2, "0");
      qtySelect.appendChild(opt);
    }

  } else {
    qtyWrapper.style.display = "none";
    addBtn.style.display = "none";
    continueBtn.style.display = "inline-block";
  }
}

function handleAddToCart() {
  if (window.USER_ROLE === "guest") {
    showConfirm(
      "Login Required",
      "You must login to add items to cart. Go to login page?",
      () => {
        const productId = document.body.dataset.productId;
        if (productId) {
          localStorage.setItem("pendingCartProduct", productId);
        }
        sessionStorage.setItem("cartLoginRequired", "true");
        showToast("Please Login To Continue", "info", 3000, true);
        window.location.href = "/login";
      }
    );
    return;
  }

  const qtySelect = document.getElementById("qtySelect");
  const qty = qtySelect ? Number(qtySelect.value) : qtySelect;

  fetch("/api/cart/add", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: document.body.dataset.productId,
      qty: qty
    })
  })
  .then(res => {
    if (!res.ok) {
      showToast("Failed To Add To Cart", "error");
      return;
    }

    const addBtn = document.getElementById("addToCartBtn");
    const goBtn = document.getElementById("goToCartBtn");

    if (addBtn) {
      addBtn.classList.add("hidden");
    }
    if (goBtn) {
      goBtn.classList.remove("hidden");
    }

    showToast("Product Added To Your Cart Successfully.", "success");

    if (typeof updateCartCount === "function") {
      updateCartCount();
    }
  })
  .catch(() => {
    showToast("Server Error While Adding To Cart", "error");
  });
}

function loadRelatedProducts(productId) {
  fetch(`/api/products/${productId}/related`)
    .then(res => {
      if (!res.ok) throw new Error("Failed To Load Related Products");
      return res.json();
    })
    .then(data => {
      if (!data || !data.products || !data.products.length) return;

      const container = document.getElementById("relatedProducts");
      if (!container) return;

      container.innerHTML = data.products.map(p => `
        <div class="product-card">

          ${window.USER_ROLE !== "admin" ? `
            <div class="wishlist-btn"
                 data-product-id="${p.id}"
                 onclick="toggleWishlist(this)">
              <i class="fa-regular fa-heart"></i>
            </div>
          ` : ""}

          <div class="product-image"
               style="background-image:url('${p.image_url || "/static/no-image.png"}')">
          </div>

          <div class="product-details">
            <h4>${p.name}</h4>
            <div class="price">₹${p.price}</div>

            <div class="product-actions">
              <button onclick="viewProduct('${p.id}')">
                View
              </button>

              ${window.USER_ROLE !== "admin" ? `
                <button onclick="addToCart('${p.id}')">
                  Add to Cart
                </button>
              ` : ""}
            </div>
          </div>

        </div>
      `).join("");

      if (typeof loadWishlistHearts === "function") {
        loadWishlistHearts();
      }
    })
    .catch(err => {
      console.error("❌ Related products error:", err);
    });
}

function toggleMainDetails() {
  const body = document.getElementById("mainDetailsBody");
  const header = document.querySelector(".product-details-toggle");

  body.classList.toggle("accordion-hidden");
  header.classList.toggle("open");
}

function toggleNested(index) {
  const body = document.getElementById(`nestedBody-${index}`);
  const arrow = document.getElementById(`nestedArrow-${index}`);

  body.classList.toggle("accordion-hidden");
  arrow.textContent =
    body.classList.contains("accordion-hidden") ? "▶" : "▼";
}
