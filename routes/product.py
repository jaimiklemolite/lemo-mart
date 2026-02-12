from flask import Blueprint, request, jsonify, current_app 
from bson.objectid import ObjectId
from bson.errors import InvalidId
from extension import mongo
from utils import login_required
from routes.utils import title_case
import os
import uuid
import json
import re

product_bp = Blueprint("products", __name__, url_prefix="/api/products")

@product_bp.route("/add", methods=["POST"])
@login_required(role="admin")
def add_product():
    name = title_case(request.form.get("name"))
    desc_ = title_case(request.form.get("description"))
    price = request.form.get("price")
    category_id = request.form.get("category_id")
    images = request.files.getlist("images")

    specs = request.form.get("specs")
    specs = json.loads(specs) if specs else []

    details = request.form.get("details")
    details = json.loads(details) if details else []

    if not name or not price or not category_id or not desc_ or not images:
        return jsonify({"message": "All fields required"}), 400

    category_doc = mongo.db.category.find_one({"_id": ObjectId(category_id)})
    if not category_doc:
        return jsonify({"message": "Invalid category"}), 400

    category_name = re.sub(r"[^a-zA-Z0-9_-]", "_", category_doc['name'])

    upload_dir = os.path.join(
        current_app.root_path,
        "static", "uploads", category_name
    )
    os.makedirs(upload_dir, exist_ok=True)

    image_urls = []

    for image in images:
        if image and image.filename:
            filename = f"{uuid.uuid4()}_{image.filename}"
            image_path = os.path.join(upload_dir, filename)
            image.save(image_path)

            image_urls.append(
                f"/static/uploads/{category_doc['name']}/{filename}"
            )

    if not image_urls:
        return jsonify({"message": "Image upload failed"}), 400

    result = mongo.db.products.insert_one({
        "name": name,
        "description": desc_,
        "category_id": ObjectId(category_id),
        "price": float(price),
        "images": image_urls,
        "image_url": image_urls[0],
        "quantity": 0,
        "specs": specs,
        "details": details
    })

    product = mongo.db.products.find_one({"_id": result.inserted_id})
    product["_id"] = str(product["_id"])
    product["category"] = category_doc["name"]

    return jsonify(product), 201

@product_bp.route("/", methods=["GET"])
def get_products():
    products = []

    for product in mongo.db.products.find():
        product["_id"] = str(product["_id"])
        product["category_id"] = str(product.get("category_id"))

        category = mongo.db.category.find_one({"_id": ObjectId(product["category_id"])})
        product["category"] = category["name"] if category else ""

        products.append(product)

    return jsonify(products), 200

@product_bp.route("/<product_id>", methods=["GET"])
def get_single_product(product_id):
    
    product = mongo.db.products.find_one({"_id": ObjectId(product_id)})

    if not product:
        return jsonify({"message": "Product not found"}), 404

    product["_id"] = str(product["_id"])

    if "category_id" in product:
        cat = mongo.db.category.find_one({"_id": product["category_id"]})
        product["category"] = cat["name"] if cat else "Unknown"

    return jsonify(product), 200

@product_bp.route("/<product_id>/related", methods=["GET"])
def get_related_products(product_id):
    try:
        pid = ObjectId(product_id)
    except:
        return jsonify({"message": "Invalid product ID"}), 400

    current = mongo.db.products.find_one({"_id": pid})
    if not current:
        return jsonify({"message": "Product not found"}), 404

    category_id = current.get("category_id")

    cursor = mongo.db.products.find({
        "_id": {"$ne": pid},
        "category_id": category_id,
        "quantity": {"$gt": 0}
    }).limit(6)

    related = []
    for p in cursor:
        related.append({
            "id": str(p["_id"]),
            "name": p.get("name"),
            "price": p.get("price"),
            "image_url": (
                p["images"][0]
                if isinstance(p.get("images"), list) and p["images"]
                else p.get("image_url", "/static/no-image.png")
            )
        })

    return jsonify({"products": related}), 200

@product_bp.route("/update-stock", methods=["PUT"])
@login_required(role="admin")
def update_stock():
    data = request.get_json()

    product_id = data.get("product_id")
    change = data.get("change")

    if not product_id or change is None:
        return jsonify({"Message": "Invalid data"}), 400

    try:
        oid = ObjectId(product_id)
    except:
        return jsonify({"Message": "Invalid product ID"}), 400

    product = mongo.db.products.find_one({"_id": oid})
    if not product:
        return jsonify({"Message": "Product not found"}), 404

    current_qty = product.get("quantity", 0)
    new_qty = current_qty + int(change)

    if new_qty < 0:
        new_qty = 0

    mongo.db.products.update_one(
        {"_id": oid},
        {"$set": {"quantity": new_qty}}
    )

    return jsonify({
        "Message": "Stock updated",
        "quantity": new_qty
    }), 200

@product_bp.route("/update/<id>", methods=["PUT"])
@login_required(role="admin")
def update_product(id):
    try:
        oid = ObjectId(id)
    except InvalidId:
        return jsonify({"message": "Invalid product ID"}), 400

    product = mongo.db.products.find_one({"_id": oid})
    if not product:
        return jsonify({"message": "Product not found"}), 404

    name = request.form.get("name")
    category_id = request.form.get("category_id")
    desc_ = request.form.get("description")
    price = request.form.get("price")
    images = request.files.getlist("images")
    specs = request.form.get("specs")
    details = request.form.get("details")

    update_data = {}

    if category_id:
        category_doc = mongo.db.category.find_one({"_id": ObjectId(category_id)})
        if not category_doc:
            return jsonify({"message": "Invalid category"}), 400

        update_data["category_id"] = ObjectId(category_id)

    if name:
        update_data["name"] = title_case(name)

    if desc_:
        update_data["description"] = title_case(desc_)

    if price:
        update_data["price"] = float(price)

    if specs:
        update_data["specs"] = json.loads(specs)

    if details is not None:
        update_data["details"] = json.loads(details)

    if images and images[0].filename:

        for old_img in product.get("images", []):
            old_path = os.path.join(current_app.root_path, old_img.lstrip("/"))
            if os.path.exists(old_path):
                os.remove(old_path)

        final_category_id = ObjectId(category_id) if category_id else product["category_id"]

        category_doc = mongo.db.category.find_one({"_id": final_category_id})
        if not category_doc:
            return jsonify({"message": "Category not found"}), 400

        import re
        category_name = re.sub(r"[^a-zA-Z0-9_-]", "_", category_doc["name"])

        upload_dir = os.path.join(
            current_app.root_path,
            "static",
            "uploads",
            category_name
        )
        os.makedirs(upload_dir, exist_ok=True)

        new_images = []

        for image in images:
            filename = f"{uuid.uuid4()}_{image.filename}"
            image_path = os.path.join(upload_dir, filename)
            image.save(image_path)

            new_images.append(f"/static/uploads/{category_name}/{filename}")

        update_data["images"] = new_images
        update_data["image_url"] = new_images[0]

    if not update_data:
        return jsonify({"message": "Nothing to update"}), 400
    
    result = mongo.db.products.update_one({"_id": oid}, {"$set": update_data})

    if result.matched_count == 0:
        return jsonify({"message": "Product not found during update"}), 404

    updated_product = mongo.db.products.find_one({"_id": oid})

    updated_product["_id"] = str(updated_product["_id"])
    updated_product["category_id"] = str(updated_product.get("category_id"))

    return jsonify(updated_product), 200

@product_bp.route("/delete/<id>", methods=["DELETE"])
@login_required(role="admin")
def delete_product(id):
    try:
        oid = ObjectId(id)
    except InvalidId:
        return jsonify({"message": "Invalid product ID"}), 400

    product = mongo.db.products.find_one({"_id": oid})
    if not product:
        return jsonify({"message": "Product not found"}), 404

    images = product.get("images", [])
    for img in images:
        img_path = os.path.join(current_app.root_path, img.lstrip("/"))
        if os.path.exists(img_path):
            os.remove(img_path)

    mongo.db.products.delete_one({"_id": oid})

    return jsonify({"message": "Product deleted successfully"}), 200
