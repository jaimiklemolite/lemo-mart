from flask import Blueprint, jsonify, session
from bson.objectid import ObjectId
from extension import mongo
from utils import login_required

wishlist_bp = Blueprint("wishlist", __name__, url_prefix="/api/users/wishlist")

@wishlist_bp.route("", methods=["GET"])
@login_required()
def get_wishlist():
    user_id = ObjectId(session.get("user_id"))
    user = mongo.db.users.find_one({"_id": user_id})

    wishlist_ids = user.get("wishlist", [])

    products = []
    for product_id in wishlist_ids:
        product = mongo.db.products.find_one({"_id": ObjectId(product_id)})
        if product:
            products.append({
                "id": str(product["_id"]),
                "name": product.get("name"),
                "price": product.get("price"),
                "quantity": product.get("quantity", 0),
                "description": product.get("description", ""),
                "category": product.get("category", ""),
                "images": product.get("images", []),
                "image_url": product.get("image_url", "/static/no-image.png")
            })

    return jsonify({"products": products}), 200

@wishlist_bp.route("/add/<product_id>", methods=["POST"])
@login_required()
def add_to_wishlist(product_id):
    if session.get("role") == "admin":
        return jsonify({"message": "Admins cannot use wishlist"}), 403
    
    user_id = ObjectId(session.get("user_id"))

    mongo.db.users.update_one(
        {"_id": user_id},
        {"$addToSet": {"wishlist": ObjectId(product_id)}}
    )

    return jsonify({"product_id": product_id}), 200

@wishlist_bp.route("/remove/<product_id>", methods=["DELETE"])
@login_required()
def remove_from_wishlist(product_id):
    if session.get("role") == "admin":
        return jsonify({"message": "Admins cannot use wishlist"}), 403
    
    user_id = ObjectId(session.get("user_id"))

    mongo.db.users.update_one(
        {"_id": user_id},
        {"$pull": {"wishlist": ObjectId(product_id)}}
    )

    return jsonify({"product_id": product_id}), 200
