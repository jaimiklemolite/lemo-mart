from flask import Blueprint, request, jsonify, current_app 
from bson.objectid import ObjectId
from bson.errors import InvalidId
from extension import mongo
from utils import login_required
from routes.utils import title_case, slugify
from datetime import datetime
import os
import uuid
import json

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

    category_name = slugify(category_doc["name"])
    product_name = slugify(name)

    upload_dir = os.path.join(
        current_app.root_path,
        "static",
        "uploads",
        category_name,
        product_name
    )
    os.makedirs(upload_dir, exist_ok=True)

    image_urls = []

    for image in images:
        if image and image.filename:
            filename = f"{uuid.uuid4()}_{image.filename}"
            image_path = os.path.join(upload_dir, filename)
            image.save(image_path)

            image_urls.append(
                f"/static/uploads/{category_name}/{product_name}/{filename}"
            )

    if not image_urls:
        return jsonify({"message": "Image upload failed"}), 400
    
    now = datetime.utcnow()

    result = mongo.db.products.insert_one({
        "name": name,
        "description": desc_,
        "category_id": ObjectId(category_id),
        "price": float(price),
        "images": image_urls,
        "image_url": image_urls[0],
        "quantity": 0,
        "specs": specs,
        "details": details,
        "created_at": now
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

    current = mongo.db.products.find_one({"_id": ObjectId(product_id)})
    if not current:
        return jsonify({"message": "Product not found"}), 404

    category_id = current.get("category_id")

    cursor = mongo.db.products.find({
        "_id": {"$ne": ObjectId(product_id)},
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

    product = mongo.db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        return jsonify({"Message": "Product not found"}), 404

    current_qty = product.get("quantity", 0)
    new_qty = current_qty + int(change)

    if new_qty < 0:
        new_qty = 0

    mongo.db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"quantity": new_qty}}
    )

    return jsonify({
        "Message": "Stock updated",
        "quantity": new_qty
    }), 200

@product_bp.route("/update/<product_id>", methods=["PUT"])
@login_required(role="admin")
def update_product(product_id):

    product = mongo.db.products.find_one({"_id": ObjectId(product_id)})
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

        category_name = slugify(category_doc["name"])
        product_name_source = name if name else product["name"]
        product_name = slugify(product_name_source)

        upload_dir = os.path.join(
            current_app.root_path,
            "static",
            "uploads",
            category_name,
            product_name
        )
        os.makedirs(upload_dir, exist_ok=True)

        new_images = []

        for image in images:
            filename = f"{uuid.uuid4()}_{image.filename}"
            image_path = os.path.join(upload_dir, filename)
            image.save(image_path)

            new_images.append(f"/static/uploads/{category_name}/{product_name}/{filename}")

        update_data["images"] = new_images
        update_data["image_url"] = new_images[0]

    if not update_data:
        return jsonify({"message": "Nothing to update"}), 400
    
    result = mongo.db.products.update_one({"_id": ObjectId(product_id)}, {"$set": update_data})

    if result.matched_count == 0:
        return jsonify({"message": "Product not found during update"}), 404

    updated_product = mongo.db.products.find_one({"_id": ObjectId(product_id)})

    updated_product["_id"] = str(updated_product["_id"])
    updated_product["category_id"] = str(updated_product.get("category_id"))

    return jsonify(updated_product), 200

@product_bp.route("/delete/<product_id>", methods=["DELETE"])
@login_required(role="admin")
def delete_product(product_id):

    product = mongo.db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        return jsonify({"message": "Product not found"}), 404

    images = product.get("images", [])
    product_folder = None
    category_folder = None

    for img in images:
        img_path = os.path.join(current_app.root_path, img.lstrip("/"))

        if os.path.exists(img_path):
            os.remove(img_path)
            if not product_folder:
                product_folder = os.path.dirname(img_path)
                category_folder = os.path.dirname(product_folder)

    if product_folder and os.path.isdir(product_folder) and not os.listdir(product_folder):
        os.rmdir(product_folder)

    if category_folder and os.path.isdir(category_folder) and not os.listdir(category_folder):
        os.rmdir(category_folder)

    mongo.db.products.delete_one({"_id": ObjectId(product_id)})

    return jsonify({"message": "Product deleted successfully"}), 200

@product_bp.route("/campaigns/create", methods=["POST"])
@login_required(role="admin")
def create_campaign():

    data = request.get_json()

    product_id = data.get("product_id")
    start = data.get("start")
    end = data.get("end")
    title = data.get("title")
    priority = data.get("priority", "MEDIUM")

    if not product_id or not start or not end:
        return jsonify({"message": "Missing fields"}), 400

    mongo.db.campaigns.insert_one({
        "product_id": ObjectId(product_id),
        "title": title or "Featured Campaign",
        "priority": priority,
        "start": datetime.fromisoformat(start),
        "end": datetime.fromisoformat(end),
        "created_at": datetime.utcnow()
    })

    return jsonify({"message": "Campaign created"})

@product_bp.route("/campaigns", methods=["GET"])
@login_required(role="admin")
def get_campaigns():

    now = datetime.utcnow()

    pipeline = [
        {
            "$lookup": {
                "from": "products",
                "localField": "product_id",
                "foreignField": "_id",
                "as": "product"
            }
        },
        {"$unwind": "$product"},
        {
            "$lookup": {
                "from": "category",
                "localField": "product.category_id",
                "foreignField": "_id",
                "as": "category"
            }
        },
        {"$unwind": {"path": "$category", "preserveNullAndEmptyArrays": True}},
        {"$sort": {"start": -1}}
    ]

    campaigns = list(mongo.db.campaigns.aggregate(pipeline))

    result = []

    for c in campaigns:

        status = "EXPIRED"

        if c["start"] <= now <= c["end"]:
            status = "LIVE"
        elif now < c["start"]:
            status = "SCHEDULED"

        result.append({
            "id": str(c["_id"]),
            "product_id": str(c["product"]["_id"]),
            "name": c["product"]["name"],
            "image": c["product"].get("image_url"),
            "category": c["category"]["name"] if c.get("category") else "",
            "title": c.get("title"),
            "priority": c.get("priority", "MEDIUM"),
            "start": c["start"].isoformat(),
            "end": c["end"].isoformat(),
            "status": status
        })

    return jsonify(result)

@product_bp.route("/campaigns/stop/<cid>", methods=["PUT"])
@login_required(role="admin")
def stop_campaign(cid):

    mongo.db.campaigns.update_one(
        {"_id": ObjectId(cid)},
        {"$set": {"end": datetime.utcnow()}}
    )

    return jsonify({"message": "Campaign stopped"})

@product_bp.route("/featured", methods=["GET"])
def get_featured_products():
    now = datetime.utcnow()
    pipeline = [
        {
            "$match": {
                "start": {"$lte": now},
                "end": {"$gte": now}
            }
        },
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

    campaigns = list(mongo.db.campaigns.aggregate(pipeline))
    products = []

    for c in campaigns:
        p = c["product"]

        category = mongo.db.category.find_one(
            {"_id": p.get("category_id")}
        )

        p["_id"] = str(p["_id"])
        p["category"] = category["name"] if category else ""

        products.append(p)

    return jsonify(products)

@product_bp.route("/new-arrivals", methods=["GET"])
def get_new_arrivals():
    products = list(
        mongo.db.products.find()
        .sort("created_at", -1)
        .limit(8)
    )

    for p in products:
        p["_id"] = str(p["_id"])

        category = mongo.db.category.find_one(
            {"_id": p.get("category_id")}
        )

        p["category"] = category["name"] if category else ""

    return jsonify(products), 200

@product_bp.route("/top-selling", methods=["GET"])
def get_top_selling():
    pipeline = [
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "totalSold": {"$sum": "$items.qty"}
        }},
        {"$sort": {"totalSold": -1}},
        {"$limit": 8}
    ]

    top = list(mongo.db.orders.aggregate(pipeline))

    if not top:
        return jsonify([]), 200

    ordered_ids = [p["_id"] for p in top]

    products = list(
        mongo.db.products.find({"_id": {"$in": ordered_ids}})
    )

    product_map = {p["_id"]: p for p in products}

    sorted_products = []

    for pid in ordered_ids:
        if pid in product_map:
            product = product_map[pid]

            category = mongo.db.category.find_one(
                {"_id": product.get("category_id")}
            )

            product["_id"] = str(product["_id"])
            product["category"] = category["name"] if category else ""

            sorted_products.append(product)

    return jsonify(sorted_products), 200
