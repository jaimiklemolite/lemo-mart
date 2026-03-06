from flask import Blueprint, request, jsonify, session
from extension import mongo
from utils import login_user, logout_user, login_required
import bcrypt
from bson.objectid import ObjectId
from datetime import datetime

user_bp = Blueprint("users", __name__, url_prefix="/api/users")

@user_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"message": "Invalid data"}), 400

    email = data["email"].lower().strip()

    user = mongo.db.users.find_one({"email": email})
    if not user:
        return jsonify({"message": "Invalid credentials"}), 401

    stored_password = user["password"]
    if isinstance(stored_password, memoryview):
        stored_password = stored_password.tobytes()

    if not bcrypt.checkpw(data["password"].encode(), stored_password):
        return jsonify({"message": "Invalid credentials"}), 401

    login_user(user)

    return jsonify({
        "message": "Login successful",
        "role": user["role"]
    }), 200

@user_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()

    if not data or not data.get("username") or not data.get("email") or not data.get("password"):
        return jsonify({"message": "Invalid data"}), 400

    username = data["username"].strip()
    email = data["email"].lower().strip()

    if mongo.db.users.find_one({"email": email}):
        return jsonify({"message": "User already exists"}), 409

    hashed_password = bcrypt.hashpw(
        data["password"].encode(),
        bcrypt.gensalt()
    )

    mongo.db.users.insert_one({
        "username": username,
        "email": email,
        "password": hashed_password,
        "role": "user",
        "membership": {
            "plan": "free",
            "discount": 0,
            "free_shipping": False,
            "early_campaign_hours": 0,
            "expires_at": None
        }
    })

    return jsonify({"message": "User registered successfully"}), 201

@user_bp.route("/logout", methods=["POST"])
@login_required()
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200

@user_bp.route("/profile", methods=["GET"])
@login_required()
def profile():
    user_id = session.get("user_id")

    user = mongo.db.users.find_one(
        {"_id": ObjectId(user_id)}
    )
    membership = user.get("membership")

    if membership and membership.get("expires_at"):

        if membership["expires_at"] < datetime.utcnow():

            # downgrade to free plan instead of removing membership
            mongo.db.users.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$set": {
                        "membership.plan": "free",
                        "membership.discount": 0,
                        "membership.free_shipping": False,
                        "membership.early_campaign_hours": 0,
                        "membership.expires_at": None
                    }
                }
            )

            user["membership"] = {
                "plan": "free",
                "discount": 0,
                "free_shipping": False,
                "early_campaign_hours": 0,
                "expires_at": None
            }

    if not user:
        session.clear()
        return jsonify({"message": "Unauthorized"}), 401

    orders = []
    for o in mongo.db.orders.find({"user_id": ObjectId(user_id)}):

        order_total = sum(
            (item.get("price_at_purchase") or item.get("price", 0)) * item["qty"]
            for item in o["items"]
        )
        total_items = o.get("total_items") or sum(item["qty"] for item in o["items"])

        orders.append({
            "id": str(o["_id"]),
            "order_number": o.get("order_number", str(o["_id"])),
            "created_at": o["created_at"].isoformat(),
            "order_total": order_total,
            "total_items": total_items,
            "status": o["status"],
            "items": o["items"],
        })

    user["_id"] = str(user["_id"])

    membership = user.get("membership", {})

    if membership and membership.get("expires_at"):
        membership["expires_at"] = membership["expires_at"].isoformat()

    return jsonify({
        "user": user,
        "membership": membership,
        "orders": orders
    }), 200

@user_bp.route("/admin/users", methods=["GET"])
@login_required(role="admin")
def get_all_users():
    users = []

    for user in mongo.db.users.find({}):

        order_count = mongo.db.orders.count_documents({
            "user_id": user["_id"]
        })

        users.append({
            "id": user["_id"],
            "username": user.get("username"),
            "email": user["email"],
            "role": user["role"],
            "order_count": order_count
        })

    return jsonify({"users": users}), 200
