from flask import Blueprint, session, request, jsonify
from bson.objectid import ObjectId
from extension import mongo
from utils import login_required

cart_bp = Blueprint("cart", __name__, url_prefix="/api/cart")

@cart_bp.route("/add", methods=["POST"])
@login_required()
def add_to_cart():
    data = request.get_json()
    product_id = data.get("product_id")
    qty = int(data.get("qty", 1))

    product = mongo.db.products.find_one({"_id": ObjectId(product_id)})
    if not product or product.get("quantity", 0) <= 0:
        return jsonify({"error": "Out of stock"}), 400

    stock = product.get("quantity", 0)
    user_id = ObjectId(session.get("user_id"))

    cart = mongo.db.carts.find_one({"user_id": user_id})

    if not cart:
        qty = min(qty, stock)

        mongo.db.carts.insert_one({
            "user_id": user_id,
            "items": [{"product_id": ObjectId(product_id), "qty": qty}]
        })

        return jsonify({
            "product_id": product_id,
            "qty": qty,
            "stock": stock
        }), 200

    items = cart.get("items", [])
    found = False

    for item in items:
        if item["product_id"] == ObjectId(product_id):
            item["qty"] = min(item["qty"] + qty, stock)
            new_qty = item["qty"]
            found = True
            break

    if not found:
        new_qty = min(qty, stock)
        items.append({"product_id": ObjectId(product_id), "qty": new_qty})

    mongo.db.carts.update_one(
        {"user_id": user_id},
        {"$set": {"items": items}}
    )

    return jsonify({
        "product_id": product_id,
        "qty": new_qty,
        "stock": stock
    }), 200

@cart_bp.route("/", methods=["GET"])
@login_required()
def get_cart():
    user_id = ObjectId(session.get("user_id"))
    cart = mongo.db.carts.find_one({"user_id": user_id})

    if not cart:
        return jsonify({"items": []}), 200

    items = []

    for item in cart.get("items", []):
        product_id = str(item["product_id"])
        qty = item["qty"]

        product = mongo.db.products.find_one({"_id": ObjectId(product_id)})
        if product:
            items.append({
                "product_id": product_id,
                "name": product["name"],
                "price": product["price"],
                "qty": qty,
                "stock": product.get("quantity", 0),
                "image_url": product.get("image_url")
            })

    return jsonify({"items": items}), 200

@cart_bp.route("/update", methods=["PUT"])
@login_required()
def update_cart_qty():
    data = request.get_json()
    product_id = data.get("product_id")
    qty = int(data.get("qty", 0))

    if not product_id or qty < 1:
        return jsonify({"error": "Invalid quantity"}), 400

    product = mongo.db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        return jsonify({"error": "Product not found"}), 404

    stock = product.get("quantity", 0)
    qty = min(qty, stock)

    user_id = ObjectId(session.get("user_id"))

    mongo.db.carts.update_one(
        {
            "user_id": user_id,
            "items.product_id": ObjectId(product_id)
        },
        {
            "$set": {"items.$.qty": qty}
        }
    )

    return jsonify({
        "product_id": product_id,
        "qty": qty,
        "stock": stock
    }), 200

@cart_bp.route("/decrease/<product_id>", methods=["PUT"])
@login_required()
def decrease_qty(product_id):
    user_id = ObjectId(session.get("user_id"))

    cart = mongo.db.carts.find_one({"user_id": user_id})
    if not cart:
        return jsonify({"message": "Cart not found"}), 404

    items = cart.get("items", [])
    updated_items = []

    new_qty = 0

    for item in items:
        if str(item["product_id"]) == product_id:
            if item["qty"] > 1:
                item["qty"] -= 1
                new_qty = item["qty"]
                updated_items.append(item)
        else:
            updated_items.append(item)

    mongo.db.carts.update_one(
        {"user_id": user_id},
        {"$set": {"items": updated_items}}
    )

    return jsonify({
        "product_id": product_id,
        "qty": new_qty
    }), 200

@cart_bp.route("/remove/<product_id>", methods=["DELETE"])
@login_required()
def remove_from_cart(product_id):
    user_id = ObjectId(session.get("user_id"))

    mongo.db.carts.update_one(
        {"user_id": user_id},
        {"$pull": {"items": {"product_id": ObjectId(product_id)}}}
    )

    return jsonify({
        "product_id": product_id,
        "removed": True
    }), 200
