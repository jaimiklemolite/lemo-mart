from flask import Blueprint, jsonify, session
from bson.objectid import ObjectId
from extension import mongo
from utils import login_required
from datetime import datetime

wishlist_bp = Blueprint("wishlist", __name__, url_prefix="/api/users/wishlist")

@wishlist_bp.route("", methods=["GET"])
@login_required()
def get_wishlist():
    user_id = ObjectId(session.get("user_id"))

    pipeline = [
        {"$match": {"user_id": user_id}},
        {
            "$lookup": {
                "from": "products",
                "localField": "product_id",
                "foreignField": "_id",
                "as": "product"
            }
        },
        {"$unwind": "$product"}
    ]

    data = list(mongo.db.wishlists.aggregate(pipeline))

    products = []
    for w in data:
        p = w["product"]

        products.append({
            "id": str(p["_id"]),
            "name": p.get("name"),
            "price": p.get("price"),
            "quantity": p.get("quantity", 0),
            "description": p.get("description", ""),
            "category": p.get("category", ""),
            "images": p.get("images", []),
            "image_url": p.get("image_url", "/static/no-image.png")
        })

    return jsonify({"products": products}), 200

@wishlist_bp.route("/add/<product_id>", methods=["POST"])
@login_required()
def add_to_wishlist(product_id):

    if session.get("role") == "admin":
        return jsonify({"message": "Admins cannot use wishlist"}), 403

    user_id = ObjectId(session.get("user_id"))
    pid = ObjectId(product_id)

    exists = mongo.db.wishlists.find_one({
        "user_id": user_id,
        "product_id": pid
    })

    if exists:
        return jsonify({"product_id": product_id}), 200

    mongo.db.wishlists.insert_one({
        "user_id": user_id,
        "product_id": pid,
        "created_at": datetime.utcnow()
    })

    return jsonify({"product_id": product_id}), 200

@wishlist_bp.route("/remove/<product_id>", methods=["DELETE"])
@login_required()
def remove_from_wishlist(product_id):

    if session.get("role") == "admin":
        return jsonify({"message": "Admins cannot use wishlist"}), 403

    user_id = ObjectId(session.get("user_id"))

    mongo.db.wishlists.delete_one({
        "user_id": user_id,
        "product_id": ObjectId(product_id)
    })

    return jsonify({"product_id": product_id}), 200
