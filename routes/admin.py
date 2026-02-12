from flask import Blueprint, render_template, request, jsonify, session
from extension import mongo
from bson.objectid import ObjectId
from utils import login_required

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

@admin_bp.route("/dashboard")
@login_required(role="admin")
def dashboard():
    users = mongo.db.users.find({})
    orders = mongo.db.orders.find()
    return render_template("admin_dashboard.html", users=users, orders=orders)
