from flask import Blueprint, request, jsonify
from utils import login_required
from bson.objectid import ObjectId
from extension import mongo

category_bp = Blueprint("categories", __name__, url_prefix="/api/categories")

@category_bp.route("/add", methods=["POST"])
@login_required(role="admin")
def add_category():
    data = request.get_json()

    name = data.get("name")
    spec_names = data.get("spec_names", [])
    detail_titles = data.get("detail_titles", [])

    if not name:
        return jsonify({"message": "Category name required"}), 400
    
    normalized_name = name.strip().lower()

    existing = mongo.db.category.find_one({"name": normalized_name})
    if existing:
        return jsonify({"message": "Category already exists"}), 400

    category = {
        "name": normalized_name,
        "spec_names": spec_names,
        "detail_titles": detail_titles
    }

    result = mongo.db.category.insert_one(category)
    category["_id"] = str(result.inserted_id)

    return jsonify(category), 201

@category_bp.route("/<category_id>", methods=["GET"])
def get_single_category(category_id):
    category = mongo.db.category.find_one({"_id": ObjectId(category_id)})

    if not category:
        return jsonify({"message": "Category not found"}), 404

    category["_id"] = str(category["_id"])
    return jsonify(category), 200

@category_bp.route("/<category_id>/template", methods=["GET"])
@login_required(role="admin")
def get_category_template(category_id):
    category = mongo.db.category.find_one({"_id": ObjectId(category_id)})
    if not category:
        return jsonify({"message": "Category not found"}), 404

    return jsonify({
        "spec_names": category.get("spec_names", []),
        "detail_titles": category.get("detail_titles", [])
    }), 200

@category_bp.route("/", methods=["GET"])
def get_categories():
    categories = []
    for c in mongo.db.category.find():
        categories.append({
            "id": str(c["_id"]),
            "name": c["name"]
        })
    return jsonify(categories), 200

@category_bp.route("/<category_id>/summary", methods=["GET"])
@login_required(role="admin")
def category_summary(category_id):
    try:
        oid = ObjectId(category_id)
    except:
        return jsonify({"message": "Invalid category id"}), 400

    category = mongo.db.category.find_one({"_id": oid})
    if not category:
        return jsonify({"message": "Category not found"}), 404

    products = list(mongo.db.products.find({"category_id": oid}))
    product_ids = [p["_id"] for p in products]
    product_count = len(products)

    total_orders = 0
    delivered_orders = 0
    total_sold_qty = 0
    revenue = 0

    if product_ids:
        orders_cursor = mongo.db.orders.find({
            "items.product_id": {"$in": product_ids}
        })

        for order in orders_cursor:
            matched = False
            delivered_matched = False

            for item in order.get("items", []):
                if item.get("product_id") in product_ids:
                    matched = True

                    if order.get("status") == "Delivered":
                        delivered_matched = True
                        qty = item.get("qty", 0)
                        price = item.get("price", 0)

                        total_sold_qty += qty
                        revenue += price * qty

            if matched:
                total_orders += 1

            if delivered_matched:
                delivered_orders += 1

    return jsonify({
        "name": category.get("name"),
        "spec_names": category.get("spec_names", []),
        "detail_titles": category.get("detail_titles", []),
        "product_count": product_count,
        "total_orders": total_orders,
        "delivered_orders": delivered_orders,
        "total_sold_qty": total_sold_qty,
        "revenue": revenue
    }), 200

@category_bp.route("/with-count", methods=["GET"])
def get_categories_with_count():
    pipeline = [
        {
            "$lookup": {
                "from": "products",
                "localField": "_id",
                "foreignField": "category_id",
                "as": "products"
            }
        },
        {
            "$project": {
                "_id": 0,
                "id": {"$toString": "$_id"},
                "name": 1,
                "count": {"$size": "$products"}
            }
        }
    ]

    result = list(mongo.db.category.aggregate(pipeline))
    return jsonify(result), 200

@category_bp.route("/update/<category_id>", methods=["PUT"])
@login_required(role="admin")
def update_category(category_id):
    data = request.get_json()

    name = data.get("name")
    spec_names = data.get("spec_names", [])
    detail_titles = data.get("detail_titles", [])

    if not name:
        return jsonify({"message": "Name required"}), 400

    normalized_name = name.strip().lower()

    existing = mongo.db.category.find_one({
        "name": normalized_name,
        "_id": {"$ne": ObjectId(category_id)}
    })
    if existing:
        return jsonify({"message": "Category already exists"}), 400

    mongo.db.category.update_one(
        {"_id": ObjectId(category_id)},
        {
            "$set": {
                "name": normalized_name,
                "spec_names": spec_names,
                "detail_titles": detail_titles
            }
        }
    )

    products = mongo.db.products.find({"category_id": ObjectId(category_id)})

    for product in products:
        old_specs = product.get("specs", [])
        old_details = product.get("details", [])

        new_specs = []
        new_details = []

        for i, spec_name in enumerate(spec_names):
            value = ""
            if i < len(old_specs):
                value = old_specs[i].get("value", "")

            new_specs.append({
                "name": spec_name,
                "value": value,
                "is_default": True
            })

        for i, title in enumerate(detail_titles):
            content = []
            if i < len(old_details):
                content = old_details[i].get("content", [])

            new_details.append({
                "title": title,
                "content": content,
                "is_default": True
            })

        mongo.db.products.update_one(
            {"_id": product["_id"]},
            {
                "$set": {
                    "specs": new_specs,
                    "details": new_details
                }
            }
        )

    updated = mongo.db.category.find_one({"_id": ObjectId(category_id)})
    if not updated:
        return jsonify({"message": "Category not found"}), 404
    updated["_id"] = str(updated["_id"])

    return jsonify(updated), 200

@category_bp.route("/delete/<category_id>", methods=["DELETE"])
@login_required(role="admin")
def delete_category(category_id):
    category = mongo.db.category.find_one({"_id": ObjectId(category_id)})
    if not category:
        return jsonify({"message": "Category not found"}), 404

    product_count = mongo.db.products.count_documents({"category_id": ObjectId(category_id)})

    if product_count > 0:
        return jsonify({"message": "Category in use"}), 400

    mongo.db.category.delete_one({"_id": ObjectId(category_id)})
    category["_id"] = str(category["_id"])

    return jsonify(category), 200
