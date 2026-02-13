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

    cart = session.get("cart", {})
    existing_qty = cart.get(product_id, 0)

    new_qty = existing_qty + qty

    if new_qty > stock:
        new_qty = stock

    cart[product_id] = new_qty

    session["cart"] = cart
    session.modified = True

    return jsonify({
        "product_id": product_id,
        "qty": new_qty,
        "stock": stock
    }), 200

@cart_bp.route("/", methods=["GET"])
@login_required()
def get_cart():
    cart = session.get("cart", {})
    items = []

    for product_id, qty in cart.items():
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

    if qty > stock:
        qty = stock

    cart = session.get("cart", {})
    cart[product_id] = qty

    session["cart"] = cart
    session.modified = True

    return jsonify({
        "product_id": product_id,
        "qty": qty,
        "stock": stock
    }), 200

@cart_bp.route("/decrease/<product_id>", methods=["PUT"])
@login_required()
def decreaseQty(product_id):
    cart = session.get("cart", {})

    if product_id not in cart:
        return jsonify({"message": "Item not in cart"}), 404

    cart[product_id] -= 1
    if cart[product_id] <= 0:
        cart.pop(product_id)

    session["cart"] = cart
    session.modified = True

    return jsonify({
        "product_id": product_id,
        "qty": cart.get(product_id, 0)
    }), 200

@cart_bp.route("/remove/<product_id>", methods=["DELETE"])
@login_required()
def remove_from_cart(product_id):
    cart = session.get("cart", {})
    cart.pop(product_id, None)

    session["cart"] = cart
    session.modified = True

    return jsonify({
        "product_id": product_id,
        "removed": True
    }), 200
