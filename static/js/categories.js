let EDITING_CATEGORY_ID = null;

document.addEventListener("DOMContentLoaded", loadCategories);

function loadCategories() {
  fetch("/api/categories/with-count")
    .then(res => res.json())
    .then(categories => {
      const container = document.getElementById("categoryGrid");
      if (!container) return;

      if (!categories.length) {
        container.innerHTML = "<p>No categories found.</p>";
        return;
      }

      container.innerHTML = categories.map(c => `
        <div class="category-card">
          <button class="info-btn"
                  onclick="showCategoryInfo('${c.id}')">
            <i class="fa-solid fa-circle-info"></i>
          </button>
          <button class="edit-btn"
                  onclick="editCategory('${c.id}')">
            <i class="fa-solid fa-pen"></i>
          </button>
          <h3>${c.name}</h3>
          <p>Products: <b>${c.count}</b></p>
          
          ${
            c.count === 0
              ? `<button class="delete-btn" onclick="deleteCategory('${c.id}')">Delete</button>`
              : `<span class="category-status in-use">In use</span>`
          }
        </div>
      `).join("");
    })
    .catch(() => showToast("Failed To Load Categories", "error"));
}

let ordersIndex = 0;
let salesIndex = 0;
let ordersData = [];
let salesData = [];

async function showCategoryInfo(categoryId) {
  try {
    const res = await fetch(`/api/categories/${categoryId}/summary`, {
      credentials: "include"
    });

    if (!res.ok) throw new Error("Request failed");

    const data = await res.json();

    document.getElementById("infoCategoryTitle").innerText =
      titleCase(data.name || "Category");

    const productCount = data.product_count || 0;
    const statusEl = document.getElementById("infoStatus");

    if (productCount === 0) {
      statusEl.innerText = "Not Active";
      statusEl.className = "status red";
    } else {
      statusEl.innerText = "Active";
      statusEl.className = "status green";
    }

    document.getElementById("infoProductCount").innerText = productCount;

    ordersData = [
      { label: "Total Orders", value: data.total_orders || 0 },
      { label: "Delivered Orders", value: data.delivered_orders || 0 }
    ];

    salesData = [
      { label: "Total Sold Qty", value: data.total_sold_qty || 0 },
      { label: "Revenue", value: `₹ ${data.revenue || 0}` }
    ];

    ordersIndex = 0;
    salesIndex = 0;

    slideOrders(0);
    slideSales(0);

    const specList = document.getElementById("infoSpecList");
    specList.innerHTML =
      (data.spec_names || []).map(s => `<li>${s}</li>`).join("") ||
      "<li>No default specs</li>";

    const detailList = document.getElementById("infoDetailList");
    detailList.innerHTML =
      (data.detail_titles || []).map(d => `<li>${d}</li>`).join("") ||
      "<li>No detail sections</li>";

    document.getElementById("categoryInfoModal").classList.remove("hidden");

  } catch (err) {
    console.error("Category info load error:", err);
    showToast("Failed to load category info", "error");
  }
}

function closeCategoryInfo() {
  document.getElementById("categoryInfoModal").classList.add("hidden");
}

function slideOrders(dir) {
  if (!ordersData.length) return;

  ordersIndex = (ordersIndex + dir + ordersData.length) % ordersData.length;

  document.getElementById("ordersLabel").innerText =
    ordersData[ordersIndex].label;

  document.getElementById("ordersValue").innerText =
    ordersData[ordersIndex].value;
}

function slideSales(dir) {
  if (!salesData.length) return;

  salesIndex = (salesIndex + dir + salesData.length) % salesData.length;

  document.getElementById("salesLabel").innerText =
    salesData[salesIndex].label;

  document.getElementById("salesValue").innerText =
    salesData[salesIndex].value;
}

function submitCategory() {
  const name = document.getElementById("category").value.trim();
  if (!name) {
    showToast("Enter Category Name", "info");
    return;
  }

  const specNames = collectSpecNames();
  const detailTitles = collectDetailTitles();

  const method = EDITING_CATEGORY_ID ? "PUT" : "POST";
  const url = EDITING_CATEGORY_ID
    ? `/api/categories/update/${EDITING_CATEGORY_ID}`
    : "/api/categories/add";

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name,
      spec_names: specNames,
      detail_titles: detailTitles
    })
  })
    .then(res => res.json())
    .then(() => {
      showToast(
        EDITING_CATEGORY_ID
          ? "Category Updated"
          : "Category Added",
        "success"
      );
      resetCategoryForm();
      loadCategories();
    });
}

function editCategory(id) {
  fetch(`/api/categories/${id}`)
    .then(res => res.json())
    .then(cat => {
      EDITING_CATEGORY_ID = id;

      document.getElementById("category").value = cat.name;

      clearSpecNames();
      (cat.spec_names || []).forEach(name => addSpecNameField(name));

      clearDetailTitles();
      (cat.detail_titles || []).forEach(title => addDetailTitleField(title));

      const btn = document.getElementById("categorySubmitBtn");
      if (btn) btn.textContent = "Update Category";
    });
}

function addSpecName(value = "") {
  const row = document.createElement("div");
  row.className = "detail-row";

  row.innerHTML = `
    <input class="spec-name" value="${value}" placeholder="Spec name">
    <button onclick="this.parentElement.remove()">✖</button>
  `;

  document.getElementById("specNameList").appendChild(row);
}

function addDetailTitle(value = "") {
  const row = document.createElement("div");
  row.className = "detail-row";

  row.innerHTML = `
    <input class="detail-title" value="${value}" placeholder="Section title">
    <button onclick="this.parentElement.remove()">✖</button>
  `;

  document.getElementById("detailTitleList").appendChild(row);
}

function deleteCategory(id) {
  showConfirm(
    "Delete Category",
    "Are you sure you want to delete this category?",
    () => {
      fetch(`/api/categories/delete/${id}`, {
        method: "DELETE",
        credentials: "include"
      })
      .then(res => res.json())
      .then(data => {
        showToast(data.message || "Category Deleted", "error");
        loadCategories();
      })
      .catch(() => showToast("Failed To Delete Category", "error"));
    }
  );
  return;
}

function resetCategoryForm() {
  EDITING_CATEGORY_ID = null;

  document.getElementById("category").value = "";

  clearSpecNames();
  clearDetailTitles();

  const btn = document.getElementById("categorySubmitBtn");
  if (btn) btn.textContent = "Add Category";
}

function clearSpecNames() {
  document.getElementById("specNameList").innerHTML = "";
}

function clearDetailTitles() {
  document.getElementById("detailTitleList").innerHTML = "";
}

function collectSpecNames() {
  return [...document.querySelectorAll(".spec-name")]
    .map(i => i.value.trim())
    .filter(Boolean);
}

function collectDetailTitles() {
  return [...document.querySelectorAll(".detail-title")]
    .map(i => i.value.trim())
    .filter(Boolean);
}

function addSpecNameField(value = "") {
  addSpecName(value);
}

function addDetailTitleField(value = "") {
  addDetailTitle(value);
}
