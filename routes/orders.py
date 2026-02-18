from flask import Blueprint, session, jsonify, request, current_app
from extension import mongo
from utils import login_required
from bson.objectid import ObjectId
from datetime import datetime
import os, shutil

order_bp = Blueprint("orders", __name__, url_prefix="/api/orders")

@order_bp.route("/place", methods=["POST"])
@login_required()
def place_order():
    user_id = ObjectId(session.get("user_id"))
    cart_doc = mongo.db.carts.find_one({"user_id": user_id})

    if not cart_doc or not cart_doc.get("items"):
        return jsonify({"message": "Cart empty"}), 400

    cart_items = cart_doc["items"]

    order_image_dir = os.path.join(
        current_app.root_path,
        "static",
        "order_images"
    )
    os.makedirs(order_image_dir, exist_ok=True)

    items = []

    for item in cart_items:
        product_id = str(item["product_id"])
        qty = item["qty"]
        product = mongo.db.products.find_one({"_id": ObjectId(product_id)})

        if not product:
            return jsonify({"message": "Product not found"}), 404

        category = mongo.db.category.find_one({"_id": product.get("category_id")})

        if product.get("quantity", 0) < qty:
            return jsonify({
                "message": f"Insufficient stock for {product['name']}"
            }), 400

        snapshot_url = product.get("image_url", "/static/no-image.png")

        if isinstance(product.get("images"), list) and product["images"]:
            original_url = product["images"][0]
            original_path = os.path.join(current_app.root_path, original_url.lstrip("/"))

            if os.path.exists(original_path):
                filename = os.path.basename(original_path)
                snapshot_path = os.path.join(order_image_dir, filename)

                if not os.path.exists(snapshot_path):
                    shutil.copyfile(original_path, snapshot_path)

                snapshot_url = f"/static/order_images/{filename}"

        mongo.db.products.update_one(
            {"_id": ObjectId(product_id)},
            {"$inc": {"quantity": -qty}}
        )

        items.append({
            "product_id": ObjectId(product_id),
            "name": product["name"],
            "price": product["price"],
            "qty": qty,
            "image_url": snapshot_url,
            "category": category["name"] if category else "Unknown"
        })

    now = datetime.utcnow()
    year = now.year
    month = now.month

    count = mongo.db.orders.count_documents({
        "created_at": {
            "$gte": datetime(year, month, 1),
            "$lt": datetime(year + (month // 12), (month % 12) + 1, 1)
        }
    })

    order_number = f"ORD-{year}-{month:02d}-{count + 1:06d}"

    mongo.db.orders.insert_one({
        "order_number": order_number,
        "user_id": user_id,
        "items": items,
        "status": "Pending",
        "created_at": now,
        "status_updated_at": now,
        "delivered_at": None,
        "cancelled_at": None,
    })

    mongo.db.carts.delete_one({"user_id": user_id})

    return jsonify({"order_number": order_number, "items": items}), 200

@order_bp.route("/all", methods=["GET"])
@login_required(role="admin")
def get_all_orders():
    orders = []

    for o in mongo.db.orders.find():
        user = mongo.db.users.find_one(
            {"_id": ObjectId(o["user_id"])}
        )
        order_total = sum(item["price"] * item["qty"] for item in o["items"])
        total_items = sum(item["qty"] for item in o["items"])

        orders.append({
            "id": str(o["_id"]),
            "order_number": o.get("order_number", str(o["_id"])),
            "username": user.get("username", "Unknown") if user else "Unknown",
            "created_at": o["created_at"].isoformat(),
            "customer_email": user.get("email", "Unknown") if user else "Unknown",
            "items": o.get("items", []),
            "order_total": order_total,
            "total_items": total_items,
            "status": o.get("status"),
        })

    return jsonify({"orders": orders}), 200

@order_bp.route("/update-status/<order_id>", methods=["PUT"])
@login_required(role="admin")
def update_order_status(order_id):
    data = request.get_json()
    new_status = data.get("status")

    STATUS_FLOW = {
        "Pending": ["Approved", "Rejected"],
        "Approved": ["Out for Delivery", "Rejected"],
        "Out for Delivery": ["Delivered"],
        "Delivered": [],
        "Rejected": []
    }

    order = mongo.db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        return jsonify({"message": "Order not found"}), 404

    current_status = order.get("status")

    if current_status in ["Delivered", "Rejected", "Cancelled"]:
        return jsonify({"message": "Order status is locked"}), 400

    allowed_next = STATUS_FLOW.get(current_status, [])
    if new_status not in allowed_next:
        return jsonify({
            "message": f"Cannot change status from {current_status} to {new_status}"
        }), 400

    now = datetime.utcnow()
    ts = int(now.timestamp())

    update_data = {
        "status": new_status,
        "status_updated_at": now,
    }

    if new_status == "Delivered":
        update_data["delivered_at"] = now

    mongo.db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": update_data}
    )

    return jsonify({"order": order}), 200

@order_bp.route("/cancel/<order_id>", methods=["PUT"])
@login_required()
def cancel_order(order_id):

    order = mongo.db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        return jsonify({"message": "Order not found"}), 404

    if order["status"] not in ["Pending", "Approved"]:
        return jsonify({"message": "Order cannot be cancelled"}), 400

    now = datetime.utcnow()
    ts = int(now.timestamp())

    mongo.db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": "Cancelled",
            "status_updated_at": now,
            "cancelled_at": now,
        }}
    )
    return jsonify({"order": order}), 200
