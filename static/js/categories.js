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
