let salesChartInstance = null;
let topProductsChartInstance = null;
let categoryChartInstance = null;
let startDate = null;
let endDate = null;

function buildQuery() {
  if (!startDate || !endDate) return "";
  return `?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
}

function onRangeChange() {
  const val = document.getElementById("rangeSelect").value;

  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");

  if (val === "custom") {
    startInput.hidden = false;
    endInput.hidden = false;
    return;
  }

  startInput.hidden = true;
  endInput.hidden = true;

  const days = parseInt(val);

  const end = new Date();
  let start = new Date();

  if (days === 1) {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setDate(end.getDate() - days);
  }

  startDate = start.toISOString();
  endDate = end.toISOString();

  loadAnalyticsDashboard();
  updateResetButtonVisibility("analyticsSection");
}

function onCustomDateChange() {
  const s = document.getElementById("startDate").value;
  const e = document.getElementById("endDate").value;

  if (!s || !e) return;

  startDate = new Date(s).toISOString();
  endDate = new Date(e).toISOString();

  loadAnalyticsDashboard();
  updateResetButtonVisibility("analyticsSection");
}

function animateValue(el, start, end, duration = 900, isCurrency = true) {
  if (!el) return;

  const range = end - start;
  if (range === 0) {
    el.textContent = isCurrency
      ? "₹" + end.toLocaleString()
      : end.toLocaleString();
    return;
  }
  const startTime = performance.now();

  function update(now) {
    const progress = Math.min((now - startTime) / duration, 1);

    const ease = 1 - Math.pow(1 - progress, 3);
    const value = Math.floor(start + range * ease);

    el.textContent = isCurrency
      ? "₹" + value.toLocaleString()
      : value.toLocaleString();

    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function loadSummary() {
  const query = buildQuery();

  Promise.all([
    fetch(`/api/admin/summary${query}`, { credentials: "include" }).then(r => r.json()),
    fetch(`/api/admin/revenue-growth${query}`, { credentials: "include" }).then(r => r.json())
  ])
  .then(([data, growthData]) => {

    const growth = growthData.growth || 0;
    const arrow = growth >= 0 ? "▲" : "▼";
    const color = growth >= 0 ? "green" : "red";

    const rangeTextMap = {
      "1": "Today",
      "7": "7 Days",
      "30": "30 Days",
      "90": "3 Months",
      "365": "1 Year",
      "custom": "Selected Range"
    };

    const selectedRange = document.getElementById("rangeSelect").value;
    const label = rangeTextMap[selectedRange] || "Range";

    document.getElementById("summaryCards").innerHTML = `
      <div class="analytics-card">
        <div class="card-icon revenue">
          <i class="fa-solid fa-sack-dollar"></i>
        </div>
        <h4>Gross Revenue</h4>
        <p id="grossRevenue">₹0</p>
      </div>

      <div class="analytics-card">
        <div class="card-icon net">
          <i class="fa-solid fa-coins"></i>
        </div>
        <h4>Net Revenue</h4>
        <p id="netRevenue">₹0</p>
      </div>

      <div class="analytics-card">
        <div class="card-icon growth">
          <i class="fa-solid fa-chart-line"></i>
        </div>
        <h4>Revenue Growth (${label})</h4>
        <p id="growthRevenue">₹0</p>
        <small style="color:${color}; font-weight:600;">
          ${arrow} ${Math.abs(growth)}% vs previous period
        </small>
      </div>

      <div class="analytics-card">
        <div class="card-icon orders">
          <i class="fa-solid fa-box-open"></i>
        </div>
        <h4>Total Delivered Orders</h4>
        <p id="totalOrders">0</p>
      </div>

      <div class="analytics-card">
        <div class="card-icon items">
          <i class="fa-solid fa-cart-shopping"></i>
        </div>
        <h4>Total Items Sold</h4>
        <p id="soldItems">0</p>
      </div>
    `;

    animateValue(document.getElementById("grossRevenue"), 0, data.gross_revenue, 900, true);
    animateValue(document.getElementById("netRevenue"), 0, data.net_revenue, 900, true);
    animateValue(document.getElementById("growthRevenue"), 0, growthData.current, 900, true);
    animateValue(document.getElementById("totalOrders"), 0, data.orders, 700, false);
    animateValue(document.getElementById("soldItems"), 0, data.sold_items, 700, false);

  })
  .catch(() => console.error("Failed to load summary"));
}

function loadSalesChart() {
  const query = buildQuery();
  fetch(`/api/admin/sales-trend${query}`, { credentials: "include" })
    .then(res => res.json())
    .then(data => {

      const ctx = document.getElementById("salesChart");
      if (!ctx) return;

      if (salesChartInstance) salesChartInstance.destroy();

      const gradientGreen = ctx.getContext("2d").createLinearGradient(0, 0, 0, 300);
      gradientGreen.addColorStop(0, "rgba(22, 163, 74, 0.35)");
      gradientGreen.addColorStop(1, "rgba(22, 163, 74, 0)");

      const gradientRed = ctx.getContext("2d").createLinearGradient(0, 0, 0, 300);
      gradientRed.addColorStop(0, "rgba(220, 38, 38, 0.35)");
      gradientRed.addColorStop(1, "rgba(220, 38, 38, 0)");

      salesChartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: data.map(d => d.date),
          datasets: [{
            label: "Revenue",
            data: data.map(d => d.revenue),
            tension: 0.35,
            fill: true,

            segment: {
              borderColor: ctx => {
                const prev = ctx.p0.parsed.y;
                const curr = ctx.p1.parsed.y;
                return curr >= prev ? "#16a34a" : "#dc2626";
              },

              backgroundColor: ctx => {
                const prev = ctx.p0.parsed.y;
                const curr = ctx.p1.parsed.y;
                return curr >= prev ? gradientGreen : gradientRed;
              }
            },

            pointRadius: 4,
            pointBackgroundColor: "#2563eb",
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Revenue Trend",
              font: { size: 16, weight: "bold" }
            },
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    })
    .catch(() => console.error("Failed to load sales chart"));
}

function loadTopProductsChart() {
  const query = buildQuery();
  fetch(`/api/admin/top-products${query}`, { credentials: "include" })
    .then(res => res.json())
    .then(data => {

      const ctx = document.getElementById("topProductsChart");
      if (!ctx) return;

      if (topProductsChartInstance) topProductsChartInstance.destroy();

      topProductsChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels: data.map(d => d.name),
          datasets: [{
            label: "Quantity Sold",
            data: data.map(d => d.qty),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Top Selling Products",
              font: { size: 16, weight: "bold" }
            },
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    })
    .catch(() => console.error("Failed to load top products chart"));
}

function loadCategoryChart() {
  const query = buildQuery();
  fetch(`/api/admin/category-revenue${query}`, { credentials: "include" })
    .then(res => res.json())
    .then(data => {

      const ctx = document.getElementById("categoryChart");
      if (!ctx) return;

      if (categoryChartInstance) categoryChartInstance.destroy();

      categoryChartInstance = new Chart(ctx, {
        type: "pie",
        data: {
          labels: data.map(d => d.category),
          datasets: [{
            data: data.map(d => d.revenue)
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Revenue by Category",
              font: { size: 16, weight: "bold" }
            },
            legend: { position: "top" }
          }
        }
      });
    })
    .catch(() => console.error("Failed to load category chart"));
}

function loadAnalyticsDashboard() {
  loadSummary();
  loadSalesChart();
  loadTopProductsChart();
  loadCategoryChart();
}
