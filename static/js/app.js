const IS_ADMIN = window.USER_ROLE === "admin";
const IS_ADMIN_PRODUCTS_PAGE = location.pathname.startsWith("/admin");
const IS_DASHBOARD_PAGE = location.pathname === "/dashboard";

// UTILITIES
function titleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function showToast(message, type = "info", duration = 3000, persist = false) {
  if (persist) {
    sessionStorage.setItem(
      "redirectToast",
      JSON.stringify({ message, type, duration })
    );
    return;
  }

  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

document.addEventListener("DOMContentLoaded", () => {
  const stored = sessionStorage.getItem("redirectToast");

  if (stored) {
    sessionStorage.removeItem("redirectToast");

    const { message, type, duration } = JSON.parse(stored);

    setTimeout(() => {
      showToast(message, type, duration);
    }, 200);
  }
});

let confirmCallback = null;

function showConfirm(title, message, onYes) {
  const modal = document.getElementById("confirmModal");
  document.getElementById("confirmTitle").innerText = title;
  document.getElementById("confirmMessage").innerText = message;

  confirmCallback = onYes;

  modal.classList.remove("hidden");
}

function closeConfirm() {
  document.getElementById("confirmModal").classList.add("hidden");
  confirmCallback = null;
}

document.getElementById("confirmYesBtn")?.addEventListener("click", () => {
  if (confirmCallback) confirmCallback();
  closeConfirm();
});

// AUTH MODULE
function login() {
  const emailVal = document.getElementById("email").value.trim();
  const passwordVal = document.getElementById("password").value.trim();

  if (!emailVal || !passwordVal) {
    showToast("Fill All The Fields", "info");
    return;
  }

  fetch("/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: emailVal, password: passwordVal })
  })
  .then(res => res.json())
  .then(data => {
    if (!data.role) {
      showToast(data.message || "Invalid Credentials", "error");
      return;
    }

    const pendingCart = localStorage.getItem("pendingCartProduct");
    const pendingWishlist = localStorage.getItem("pendingWishlistProduct");

    if (data.role === "admin") {
      localStorage.removeItem("pendingCartProduct");
      localStorage.removeItem("pendingWishlistProduct");
      showToast("Admin Login Successful", "success", 3000, true);
      window.location.href = "/dashboard";
      return;
    }

    if (pendingCart) {
      fetch("/api/cart/add", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: pendingCart })
      })
      .then(async res => {
        localStorage.removeItem("pendingCartProduct");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          showToast(data.message || "Cannot add to cart", "error", 3000, true);
          window.location.href = "/dashboard";
          return;
        }
        showToast("Product Added To Your Cart Successfully.", "success", 3000, true);
        window.location.href = "/cart";
      });
      return;
    }

    if (pendingWishlist) {
      fetch(`/api/users/wishlist/add/${pendingWishlist}`, {
        method: "POST",
        credentials: "include"
      }).finally(() => {
        localStorage.removeItem("pendingWishlistProduct");
        showToast("Product Added To Your Wishlist", "success", 3000, true);
        window.location.href = "/dashboard";
      });
      return;
    }

    showToast("Login Successful", "success", 3000, true);
    window.location.href = "/dashboard";
  });
}

function logout() {
  document
    .querySelectorAll(".icon-btn")
    .forEach(el => el.classList.remove("show"));

  fetch("/api/users/logout", {
    method: "POST",
    credentials: "include"
  }).finally(() => {
    showToast("Logout Successful", "success", 3000, true);
    window.location.href = "/";
  });
}

function signup() {
  const nameVal = document.getElementById("name").value.trim();
  const emailVal = document.getElementById("email").value.trim();
  const passwordVal = document.getElementById("password").value.trim();

  if (!nameVal || !emailVal || !passwordVal) {
    showToast("Fill All The Fields", "info");
    return;
  }

  fetch("/api/users/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: nameVal,
      email: emailVal,
      password: passwordVal
    })
  })
  .then(res => res.json())
  .then(() => {
    showToast("Registered Successfully. Please Login.", "success", 3000, true);
    window.location.href = "/login";
  });
}

function loadProfileDropdown() {
  fetch("/api/users/profile", { credentials: "include" })
    .then(res => {
      const dropdown = document.getElementById("profileDropdown");
      if (!dropdown) return;

      if (!res.ok) {
        dropdown.innerHTML = `
          <a href="/login">
            <i class="fa-solid fa-right-to-bracket"></i> Login
          </a>
        `;
        return null;
      }

      return res.json();
    })
    .then(data => {
      if (!data) return;

      const { user } = data;
      const isProfilePage = location.pathname === "/profile";
      const dropdown = document.getElementById("profileDropdown");
      if (!dropdown) return;

      if (user.role === "admin") {
        dropdown.innerHTML = `
          <a href="/profile"
             class="dropdown-profile-link ${isProfilePage ? "active" : ""}">
            <i class="fa-solid fa-user"></i> Profile
          </a>

          <a href="#" onclick="logout()">
            <i class="fa-solid fa-right-from-bracket"></i> Logout
          </a>
        `;
      }

      else {
        const isOrdersPage = location.pathname === "/orders";

        dropdown.innerHTML = `
          <a href="/profile"
             class="dropdown-profile-link ${isProfilePage ? "active" : ""}">
            <i class="fa-solid fa-user"></i> Profile
          </a>

          <a href="/orders" class="dropdown-profile-link ${isOrdersPage ? "active" : ""}">
            <i class="fa-solid fa-truck"></i> Orders
          </a>

          <a href="#" onclick="logout()">
            <i class="fa-solid fa-right-from-bracket"></i> Logout
          </a>
        `;
      }

      setTimeout(() => {
        const activeLink = document.querySelector(
          ".profile-dropdown a.dropdown-profile-link.active"
        );
        if (activeLink) {
          activeLink.classList.add("active");
        }
      }, 0);
    });
}

function handleHeaderIconsVisibility() {
  const cartBtn = document.querySelector(".icon-btn[title='Cart']");
  const wishBtn = document.querySelector(".icon-btn[title='Wishlist']");

  if (!cartBtn || !wishBtn) return;

  cartBtn.classList.remove("show");
  wishBtn.classList.remove("show");

  fetch("/api/users/profile", { credentials: "include" })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (!data || !data.user) return;

      if (data.user.role !== "admin") {
        cartBtn.classList.add("show");
        wishBtn.classList.add("show");
      }
    })
    .catch(() => {});
}

document.addEventListener("click", (e) => {
  const menu = document.querySelector(".profile-menu");
  const dropdown = document.getElementById("profileDropdown");

  if (!menu || !dropdown) return;

  if (menu.contains(e.target)) {
    dropdown.classList.toggle("open");
  } else {
    dropdown.classList.remove("open");
  }
});

// PRODUCTS MODULE
let productCache = [];
const imageIndexMap = {};

function loadProducts(showAdmin = false) {
  fetch("/api/products/", { credentials: "include" })
    .then(res => {
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/";
        return;
      }
      return res.json();
    })
    .then(data => {
      if (!data) return;

      productCache = Array.isArray(data) ? data : [];

      renderProducts(
        productCache,
        IS_ADMIN_PRODUCTS_PAGE,
        IS_DASHBOARD_PAGE && IS_ADMIN
      );

      if (!IS_ADMIN) {
        loadWishlistHearts();
      }
    })
    .catch(err => console.error("Failed to load products", err));
}

function renderProducts(list, showAdmin = false, isAdminView = false) {
  const container = document.getElementById("products");
  if (!container) return;

  window.imageIndexMap = window.imageIndexMap || {};

  container.innerHTML = list.map((p, index) => {
    const images = Array.isArray(p.images) && p.images.length
      ? p.images
      : [p.image_url || "/static/no-image.png"];

    if (imageIndexMap[p._id] === undefined) {
      imageIndexMap[p._id] = 0;
    }

    return `
      <div class="product-card ${p.quantity === 0 ? "out-of-stock" : ""}">

        ${!IS_ADMIN ? `
          <div class="wishlist-btn"
               data-product-id="${p._id}"
               onclick="toggleWishlist(this)">
            <i class="fa-regular fa-heart"></i>
          </div>
        ` : ""}

        <div class="product-image-slider">
          <button class="arrow left"
            onclick="slideProductImage('${p._id}', -1)">‹</button>

          <div class="slider-image"
               id="img-${p._id}"
               style="background-image:url('${images[imageIndexMap[p._id]]}')">
          </div>

          <button class="arrow right"
            onclick="slideProductImage('${p._id}', 1)">›</button>
        </div>

        <div class="product-details">
          <h4>${p.name}</h4>
          <div class="type">${p.description}</div>
          <div class="category">${titleCase(p.category)}</div>

          ${
            p.quantity === 0
              ? `<div class="stock-label out-stock">Out of Stock</div>`
              : `<div class="stock-label in-stock">In Stock (${p.quantity})</div>`
          }

          <div class="price">₹${p.price}</div>

          <div class="product-actions">
            <button onclick="viewProduct('${p._id}')">View</button>

            ${
              showAdmin
                ? `
                  <div class="qty-control">
                    <button ${p.quantity === 0 ? "disabled" : ""}
                      onclick="updateStock('${p._id}', -1)">−</button>
                    <span class="qty">${p.quantity}</span>
                    <button onclick="updateStock('${p._id}', 1)">+</button>
                  </div>
                  <button onclick="editProductById('${p._id}')">Edit</button>
                  <button class="delete"
                          onclick="deleteProduct('${p._id}')">Delete</button>
                `
                : (
                    isAdminView
                      ? ``
                      : (
                          location.pathname === "/wishlist"
                            ? `
                              <button class="move-to-cart"
                                onclick="moveToCart('${p._id}')">
                                Move to Cart
                              </button>
                            `
                            : `
                              <button class="add-to-cart"
                                onclick="addToCart('${p._id}')">
                                Add to Cart
                              </button>
                            `
                        )
                  )
            }
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function slideProductImage(productId, direction) {
  const product = productCache.find(p => p._id === productId);
  if (!product || !product.images || product.images.length <= 1) return;

  const total = product.images.length;

  imageIndexMap[productId] =
    (imageIndexMap[productId] + direction + total) % total;

  const imgDiv = document.getElementById(`img-${productId}`);
  if (imgDiv) {
    imgDiv.style.backgroundImage =
      `url('${product.images[imageIndexMap[productId]]}')`;
  }
}

function viewProduct(id) {
  window.location.href = "/products/" + id;
}

async function editProductById(productId) {
  const p = productCache.find(prod => prod._id === productId);
  if (!p) return;

  clearForm();

  document.getElementById("productId").value = p._id;
  document.getElementById("name").value = p.name || "";
  document.getElementById("price").value = p.price || "";
  document.getElementById("description").value = p.description || "";

  const categorySelect = document.getElementById("categorySelect");
  if (categorySelect && p.category_id) {
    categorySelect.value = p.category_id;
    categorySelect.disabled = true;
    categorySelect.classList.add("locked-input");
  }

  try {
    const res = await fetch(`/api/categories/${p.category_id}/template`, {
      credentials: "include"
    });

    const template = await res.json();

    clearSpecs();
    clearDetails();

    (template.spec_names || []).forEach((name, index) => {

      let existingSpec =
        (p.specs || []).find(s => s.name === name);

      if (!existingSpec && p.specs && p.specs[index]) {
        existingSpec = p.specs[index];
      }

      addSpecRow(
        name,
        existingSpec?.value || "",
        true,
        true
      );
    });

    (template.detail_titles || []).forEach((title, index) => {

      let existingDetail =
        (p.details || []).find(d => d.title === title);

      if (!existingDetail && p.details && p.details[index]) {
        existingDetail = p.details[index];
      }

      addDetailSection(
        title,
        existingDetail?.content || [],
        true,
        true
      );
    });

  } catch (err) {
    console.error("Template load error:", err);
    showToast("Failed to load latest category template", "error");
  }
  openAdminTab("formTab");
}

function addProduct() {
  const fd = new FormData();

  const name = document.getElementById("name").value.trim();
  const price = document.getElementById("price").value.trim();
  const desc = document.getElementById("description").value.trim();
  const categoryId = document.getElementById("categorySelect").value;

  if (!categoryId) {
    showToast("Select Category", "info");
    return;
  }

  if (!name || !price || !desc) {
    showToast("Please Fill All Product Fields", "info");
    return;
  }

  fd.append("name", name);
  fd.append("price", price);
  fd.append("description", desc);
  fd.append("category_id", categoryId);

  const specs = collectProductSpecs();
  fd.append("specs", JSON.stringify(specs));

  fd.append("details", JSON.stringify(collectDetails()));

  const imagesInput = document.getElementById("images");
  if (!imagesInput || !imagesInput.files.length) {
    showToast("Please Select At Least One Image", "info");
    return;
  }

  for (let file of imagesInput.files) {
    fd.append("images", file);
  }

  fetch("/api/products/add", {
    method: "POST",
    credentials: "include",
    body: fd
  })
    .then(res => res.json())
    .then(product => {
      if (!product || !product._id) {
        showToast("Failed To Add Product", "error");
        return;
      }

      showToast("Product Added Successfully", "success");
      clearForm();
      loadProducts(true);
      openAdminTab("productsTab");
    })
    .catch(() => showToast("Server Error While Adding Product", "error"));
}

function updateProduct() {
  const id = document.getElementById("productId").value;
  if (!id) {
    showToast("Select A Product To Update", "info");
    return;
  }

  const fd = new FormData();

  ["name", "price", "description"].forEach(field => {
    const el = document.getElementById(field);
    if (el && el.value.trim()) {
      fd.append(field, el.value.trim());
    }
  });

  const categoryId = document.getElementById("categorySelect").value;
  if (categoryId) fd.append("category_id", categoryId);

  const specs = collectProductSpecs();
  fd.append("specs", JSON.stringify(specs));

  fd.append("details", JSON.stringify(collectDetails()));

  const imagesInput = document.getElementById("images");
  if (imagesInput && imagesInput.files.length) {
    for (let file of imagesInput.files) {
      fd.append("images", file);
    }
  }

  fetch("/api/products/update/" + id, {
    method: "PUT",
    credentials: "include",
    body: fd
  })
    .then(res => res.json())
    .then(data => {
      if (!data || !data._id) {
        showToast(data?.message || "Update Failed", "error");
        return;
      }
      showToast("Product Updated Successfully", "success");
      clearForm();
      loadProducts(true);
      openAdminTab("productsTab");
    })
    .catch(() => {
      showToast("Server Error While Updating Product", "error");
    });
}

function deleteProduct(productId) {
  showConfirm(
    "Delete Product",
    "Are you sure you want to delete this product?",
    () => {
      fetch(`/api/products/delete/${productId}`, {
        method: "DELETE",
        credentials: "include"
      })
      .then(res => res.json())
      .then(data => {
        if (!data.message) {
          showToast("Failed To Delete Product", "error");
          return;
        }

        showToast("Product Deleted Successfully", "error");
        loadProducts(true);
      })
      .catch(() => showToast("Server Error While Deleting Product", "error"));
    }
  );
  return;
}

function updateStock(productId, change) {
  fetch("/api/products/update-stock", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId, change })
  }).then(() => loadProducts(true));
}

function validateImages(files) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 7 * 1024 * 1024;

  for (let file of files) {
    if (!allowedTypes.includes(file.type)) {
      showToast("Only JPG, PNG, WEBP images Allowed", "info");
      return false;
    }
    if (file.size > maxSize) {
      showToast("Each Image Must Be Under 7MB", "info");
      return false;
    }
  }
  return true;
}

function previewImages() {
  const preview = document.getElementById("imagePreview");
  const files = document.getElementById("images").files;

  preview.innerHTML = "";

  Array.from(files).forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.width = "80px";
    img.style.marginRight = "10px";
    img.style.borderRadius = "6px";
    preview.appendChild(img);
  });
}

function clearImagePreview() {
  const preview = document.getElementById("imagePreview");
  if (preview) {
    preview.innerHTML = "";
  }

  const imagesInput = document.getElementById("images");
  if (imagesInput) {
    imagesInput.value = "";
  }
}

function clearForm() {
  ["productId", "name", "price", "description"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const categorySelect = document.getElementById("categorySelect");
  if (categorySelect) {
    categorySelect.value = "";
    categorySelect.disabled = false;
    categorySelect.classList.remove("locked-input");
  }
  
  const groupSelect = document.getElementById("detailGroupSelect");
  if (groupSelect) {
    groupSelect.style.display = "inline-block";
  }

  const groupInput = document.getElementById("detailGroupInput");
  if (groupInput) {
    groupInput.readOnly = false;
    groupInput.classList.remove("locked-input");
  }

  clearImagePreview();
  clearSpecs();
  clearDetails();
}

function clearSpecs() {
  const container = document.getElementById("specRows");
  if (container) {
    container.innerHTML = "";
  }
  specGroupCount = 0;
}

function clearDetails() {
  const container = document.getElementById("detailSections");
  if (container) container.innerHTML = "";
}

function addSpecRow(name = "", value = "", readonly = false, isDefault = false) {
  const container = document.getElementById("specRows");

  const row = document.createElement("div");
  row.className = "spec-row";

  row.innerHTML = `
    <input
      value="${name}"
      ${readonly ? "readonly class='locked-input'" : "placeholder='Spec Name'"}
      data-default="${isDefault}" >
    <input value="${value}" placeholder="Spec Value">
    ${readonly ? "" : `<button onclick="this.parentElement.remove()">✖</button>`}
  `;
  container.appendChild(row);
}

function collectProductSpecs() {
  const specs = [];

  document.querySelectorAll("#specRows .spec-row").forEach(row => {
    const inputs = row.querySelectorAll("input");

    const name = inputs[0].value.trim();
    const value = inputs[1].value.trim();

    if (name && value) {
      specs.push({
        name,
        value,
        is_default: inputs[0].dataset.default === "true"
      });
    }
  });
  return specs;
}

function loadSpecsForEdit(specs) {
  const container = document.getElementById("specRows");
  container.innerHTML = "";

  specs.forEach(s => {
    addSpecRow(
      s.name,
      s.value,
      s.is_default === true,
      s.is_default === true
    );
  });
}

function addDetailSection(title = "", items = [], readonly = false, isDefault = false) {
  const container = document.getElementById("detailSections");

  const section = document.createElement("div");
  section.className = "detail-group";

  section.innerHTML = `
    <div class="detail-group-header">
      <input
        class="detail-title ${title ? "locked-input" : ""}"
        placeholder="Section title"
        value="${title}"
        ${title ? "readonly" : ""}
        data-default="${isDefault}" >
        ${readonly ? "" : `<button class="remove-btn" onclick="this.closest('.detail-group').remove()">✖</button>`}
    </div>

    <div class="detail-rows"></div>
    <button class="product-btn small" onclick="addDetailItem(this)">
      + Add Line
    </button>
  `;

  container.appendChild(section);

  const rows = section.querySelector(".detail-rows");

  items.forEach(text => {
    const row = document.createElement("div");
    row.className = "detail-row";
    row.innerHTML = `
      <input value="${text}" placeholder="Detail line">
      <button onclick="this.parentElement.remove()">✖</button>
    `;
    rows.appendChild(row);
  });
}

function addDetailItem(btn) {
  const rows = btn.parentElement.querySelector(".detail-rows");

  const row = document.createElement("div");
  row.className = "detail-row";

  row.innerHTML = `
    <input placeholder="Detail line">
    <button onclick="this.parentElement.remove()">✖</button>
  `;
  rows.appendChild(row);
}

function collectDetails() {
  const sections = [];

  document.querySelectorAll(".detail-group").forEach(sec => {
    const title = sec.querySelector(".detail-title").value.trim();
    if (!title) return;

    const lines = [];

    sec.querySelectorAll(".detail-row input").forEach(i => {
      if (i.value.trim()) lines.push(i.value.trim());
    });

    if (lines.length) {
      sections.push({
        title,
        content: lines,
        is_default: sec.querySelector(".detail-title").dataset.default === "true"
      });
    }
  });
  return sections;
}

function applyFilters() {
  const q = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";
  const cat = document.getElementById("categoryFilter")?.value || "";
  const sort = document.getElementById("sortFilter")?.value || "";

  let filtered = [...productCache];

  if (q) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  if (cat) {
    filtered = filtered.filter(p => p.category_id === cat);
  }

  if (sort === "price_asc") filtered.sort((a, b) => a.price - b.price);
  if (sort === "price_desc") filtered.sort((a, b) => b.price - a.price);
  if (sort === "name_asc") filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "name_desc") filtered.sort((a, b) => b.name.localeCompare(a.name));

  renderProducts(
    filtered,
    IS_ADMIN_PRODUCTS_PAGE,
    IS_DASHBOARD_PAGE && IS_ADMIN
  );
}

function loadCategoryFilter() {
  fetch("/api/categories/with-count")
    .then(res => res.json())
    .then(categories => {
      const select = document.getElementById("categoryFilter");
      if (!select) return;

      select.innerHTML = `<option value="">All Categories</option>`;

      categories.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = `${titleCase(c.name)} (${c.count})`;
        select.appendChild(option);
      });
    })
    .catch(() => console.error("Failed to load category filter"));
}

function loadCategoryDropdown() {
  fetch("/api/categories")
    .then(res => res.json())
    .then(categories => {
      const select = document.getElementById("categorySelect");
      if (!select) return;

      select.innerHTML = `<option value="">Select Category</option>`;

      categories.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
      });

      select.addEventListener("change", async () => {
        const categoryId = select.value;
        if (!categoryId) {
          clearSpecs();
          clearDetails();
          return;
        }
        try {
          const res = await fetch(`/api/categories/${categoryId}/template`, {
            credentials: "include"
          });

          const template = await res.json();
          clearSpecs();
          clearDetails();
          loadSpecsFromTemplate(template.spec_names || []);
          loadDetailsFromTemplate(template.detail_titles || []);
        } catch (err) {
          showToast("Failed To Load Category Template", "error");
        }
      });
    });
}

function loadCategoryTemplate(categoryId) {
  if (!categoryId) return;

  return fetch(`/api/categories/${categoryId}/template`, { credentials: "include" })
    .then(res => res.json())
    .then(template => {
      loadSpecsFromTemplate(template.spec_names || []);
      loadDetailsFromTemplate(template.detail_titles || []);
    })
    .catch(() => showToast("Failed To Load Category Template", "error"));
}

function loadSpecsFromTemplate(specNames) {
  const container = document.getElementById("specRows");
  container.innerHTML = "";

  specNames.forEach(name => {
    addSpecRow(name, "", true, true);
  });
}

function loadDetailsFromTemplate(detailTitles) {
  const container = document.getElementById("detailSections");
  if (!container) return;

  container.innerHTML = "";

  detailTitles.forEach(title => {
    addDetailSection(title, [], true, true);
  });
}

function addToCart(productId) {
  fetch("/api/cart/add", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId })
  })
  .then(async res => {
    if (res.status === 401) {
      showConfirm(
        "Login Required",
        "You must login to add items to cart. Go to login page?",
        () => {
          localStorage.setItem("pendingCartProduct", productId);
          showToast("Please Login To Continue", "info", 3000, true);
          window.location.href = "/login";
        }
      );
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.message || "Cannot add to cart", "error");
      return;
    }
    showToast("Product Added To Your Cart Successfully.", "success");
    updateCartCount();
  });
}

async function moveToCart(productId) {
  try {
    const res = await fetch("/api/cart/add", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId })
    });

    if (!res.ok) {
      showToast("Failed To Add Product To Cart", "error");
      return;
    }

    await fetch(`/api/users/wishlist/remove/${productId}`, {
      method: "DELETE",
      credentials: "include"
    });

    showToast("Product Moved To Your Cart Successfully.", "success");

    updateCartCount();
    updateWishlistCount();

    if (typeof loadWishlistPage === "function") {
      loadWishlistPage();
    }

  } catch (err) {
    showToast("Move To Cart Failed", "error");
  }
}

function updateCartCount() {
  fetch("/api/cart", { credentials: "include" })
    .then(res => {
      if (!res.ok) return null;
      return res.json();
    })
    .then(data => {
      const badge = document.getElementById("cartCount");
      if (!badge || !data || !data.items) return;

      const count = data.items.length;

      if (count === 0) {
        badge.classList.add("hidden");
      } else {
        badge.textContent = count;
        badge.classList.remove("hidden");
      }
    })
    .catch(() => {});
}

function updateWishlistCount() {
  fetch("/api/users/wishlist", { credentials: "include" })
    .then(res => {
      if (res.status === 401) return null;
      return res.json();
    })
    .then(data => {
      const badge = document.getElementById("wishlistCount");
      if (!badge || !data || !data.products) return;

      const count = data.products.length;

      if (count === 0) {
        badge.classList.add("hidden");
      } else {
        badge.textContent = count;
        badge.classList.remove("hidden");
      }
    })
    .catch(() => {});
}

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

function openAdminTab(sectionId, btn) {

  document.querySelectorAll(".admin-section")
    .forEach(sec => sec.classList.add("hidden"));

  document.querySelectorAll(".tab-btn")
    .forEach(tab => tab.classList.remove("active"));

  const section = document.getElementById(sectionId);
  if (section) section.classList.remove("hidden");

  if (!btn) {
    btn = document.querySelector(`.tab-btn[onclick*="${sectionId}"]`);
  }

  if (btn) btn.classList.add("active");

  if (sectionId === "usersSection" && !cachedUsers.length) {
    loadUsers();
  }

  if (sectionId === "ordersSection" && !cachedOrders.length) {
    loadOrders();
  }
  if (sectionId === "analyticsSection") {
    const rangeSelect = document.getElementById("rangeSelect");
    if (!startDate || !endDate) {
      rangeSelect.value = "7";
      onRangeChange();
    } else {
      loadAnalyticsDashboard();
    }
  }
}

function getTabFromURL(defaultTab) {
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") || defaultTab;
}

document.addEventListener("DOMContentLoaded", () => {
  loadProfileDropdown();
  handleHeaderIconsVisibility();
  updateCartCount();
  updateWishlistCount();
  
  if (IS_ADMIN_PRODUCTS_PAGE) {
    loadCategoryDropdown();
  }

  if (location.pathname === "/admin/dashboard") {
    const tab = getTabFromURL("usersSection");
    openAdminTab(tab);
  }

  if (location.pathname !== "/wishlist") {
    loadProducts();
    loadCategoryFilter();
  }

  if (location.pathname.startsWith("/admin/products")) {
    const tab = getTabFromURL("productsTab");
    openAdminTab(tab);
  }
});
