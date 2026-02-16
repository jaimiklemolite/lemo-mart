let salesChartInstance = null;
let topProductsChartInstance = null;
let categoryChartInstance = null;

function loadSummary() {
  fetch("/api/admin/summary", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      document.getElementById("summaryCards").innerHTML = `
        <div class="analytics-card">
          <h4>Gross Revenue</h4>
          <p>₹${data.gross_revenue}</p>
        </div>

        <div class="analytics-card">
          <h4>Net Revenue</h4>
          <p>₹${data.net_revenue}</p>
        </div>

        <div class="analytics-card">
          <h4>Total Orders</h4>
          <p>${data.orders}</p>
        </div>

        <div class="analytics-card">
          <h4>Items Sold</h4>
          <p>${data.sold_items}</p>
        </div>
      `;
    });
}

function loadSalesChart() {
  fetch("/api/admin/sales-trend", { credentials: "include" })
    .then(res => res.json())
    .then(data => {

      const ctx = document.getElementById("salesChart");
      if (!ctx) return;

      if (salesChartInstance) salesChartInstance.destroy();

      salesChartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: data.map(d => d.date),
          datasets: [{
            label: "Revenue",
            data: data.map(d => d.revenue),
            tension: 0.35,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Revenue Trend (Last Days)",
              font: { size: 16, weight: "bold" }
            },
            legend: { display: true }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    })
    .catch(() => console.error("Failed to load sales chart"));
}

function loadTopProductsChart() {
  fetch("/api/admin/top-products", { credentials: "include" })
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
  fetch("/api/admin/category-revenue", { credentials: "include" })
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
              text: "Revenue Distribution by Category",
              font: { size: 16, weight: "bold" }
            },
            legend: {
              position: "top"
            }
          },
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
