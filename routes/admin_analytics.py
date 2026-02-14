from flask import Blueprint, jsonify
from extension import mongo
from utils import login_required

admin_analytics_bp = Blueprint("admin_analytics", __name__, url_prefix="/api/admin")

@admin_analytics_bp.route("/summary", methods=["GET"])
@login_required(role="admin")
def get_summary():

    total_orders = mongo.db.orders.count_documents({})
    total_users = mongo.db.users.count_documents({})

    net_pipeline = [
        {"$match": {"status": "Delivered"}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": None,
                "revenue": {
                    "$sum": {"$multiply": ["$items.price", "$items.qty"]}
                },
                "sold_items": {"$sum": "$items.qty"}
            }
        }
    ]

    net_result = list(mongo.db.orders.aggregate(net_pipeline))
    net_revenue = net_result[0]["revenue"] if net_result else 0
    sold_items = net_result[0]["sold_items"] if net_result else 0

    gross_pipeline = [
        {"$match": {"status": {"$in": ["Approved", "Out for Delivery", "Delivered"]}}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": None,
                "revenue": {
                    "$sum": {"$multiply": ["$items.price", "$items.qty"]}
                }
            }
        }
    ]

    gross_result = list(mongo.db.orders.aggregate(gross_pipeline))
    gross_revenue = gross_result[0]["revenue"] if gross_result else 0


    return jsonify({
        "orders": total_orders,
        "users": total_users,
        "gross_revenue": gross_revenue,
        "net_revenue": net_revenue,
        "sold_items": sold_items
    })

@admin_analytics_bp.route("/sales-trend", methods=["GET"])
@login_required(role="admin")
def sales_trend():
    pipeline = [
        {"$match": {"status": "Delivered"}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$created_at"
                    }
                },
                "revenue": {
                    "$sum": {"$multiply": ["$items.price", "$items.qty"]}
                }
            }
        },
        {"$sort": {"_id": 1}}
    ]

    data = list(mongo.db.orders.aggregate(pipeline))

    return jsonify([
        {"date": d["_id"], "revenue": d["revenue"]}
        for d in data
    ])

@admin_analytics_bp.route("/top-products", methods=["GET"])
@login_required(role="admin")
def top_products():
    pipeline = [
        {"$match": {"status": "Delivered"}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.name",
                "qty": {"$sum": "$items.qty"}
            }
        },
        {"$sort": {"qty": -1}},
        {"$limit": 5}
    ]

    data = list(mongo.db.orders.aggregate(pipeline))

    return jsonify([
        {"name": d["_id"], "qty": d["qty"]}
        for d in data
    ])

@admin_analytics_bp.route("/category-revenue", methods=["GET"])
@login_required(role="admin")
def category_revenue():
    pipeline = [
        {"$match": {"status": "Delivered"}},
        {"$unwind": "$items"},
        {
            "$lookup": {
                "from": "products",
                "localField": "items.product_id",
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
                "as": "cat"
            }
        },
        {"$unwind": "$cat"},
        {
            "$group": {
                "_id": "$cat.name",
                "revenue": {
                    "$sum": {"$multiply": ["$items.price", "$items.qty"]}
                }
            }
        }
    ]

    data = list(mongo.db.orders.aggregate(pipeline))

    return jsonify([
        {"category": d["_id"], "revenue": d["revenue"]}
        for d in data
    ])
