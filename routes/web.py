from flask import Blueprint, render_template, redirect
from utils import login_required

web_bp = Blueprint("web", __name__)

@web_bp.route("/")
def home():
    return redirect("/dashboard")

@web_bp.route("/login")
def login_page():
    return render_template("login.html")

@web_bp.route("/signup")
def signup_page():
    return render_template("signup.html")

@web_bp.route("/forgot-password")
def forgot_password():
    return render_template("forgot_password.html")

@web_bp.route("/about")
def about():
    return render_template("about.html")

@web_bp.route("/contact")
def contact():
    return render_template("contact.html")

@web_bp.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@web_bp.route("/profile")
@login_required()
def profile():
    return render_template("profile.html")

@web_bp.route("/orders")
@login_required()
def orders():
    return render_template("orders.html")

@web_bp.route("/cart")
@login_required()
def cart():
    return render_template("cart.html")

@web_bp.route("/wishlist")
@login_required()
def wishlist():
    return render_template("wishlist.html")

@web_bp.route("/products/<product_id>")
def product_details(product_id):
    return render_template("product_details.html", product_id=product_id)

@web_bp.route("/admin/dashboard")
@login_required(role="admin")
def admin_dashboard():
    return render_template("admin_dashboard.html")

@web_bp.route("/admin/products")
@login_required(role="admin")
def admin_products():
    return render_template("products.html")

@web_bp.route("/admin/categories")
@login_required(role="admin")
def admin_categories():
    return render_template("admin_categories.html")
