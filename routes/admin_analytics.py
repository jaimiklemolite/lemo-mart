from flask import Blueprint, jsonify, request
from extension import mongo
from utils import login_required
from routes.utils import parse_date_range
from datetime import datetime

admin_analytics_bp = Blueprint("admin_analytics", __name__, url_prefix="/api/admin")

@admin_analytics_bp.route("/summary", methods=["GET"])
@login_required(role="admin")
def get_summary():
    match_stage = parse_date_range()

    net_pipeline = []
    if match_stage:
        net_pipeline.append(match_stage)

    net_pipeline += [
        {"$match": {"status": "Delivered"}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": None,
                "net_revenue": {
                    "$sum": {"$multiply": ["$items.price", "$items.qty"]}
                },
                "sold_items": {"$sum": "$items.qty"},
                "orders": {"$addToSet": "$_id"}
            }
        },
        {
            "$project": {
                "_id": 0,
                "net_revenue": 1,
                "sold_items": 1,
                "orders": {"$size": "$orders"}
            }
        }
    ]

    net_result = list(mongo.db.orders.aggregate(net_pipeline))
    net_data = net_result[0] if net_result else {
        "net_revenue": 0,
        "sold_items": 0,
        "orders": 0
    }

    gross_pipeline = []
    if match_stage:
        gross_pipeline.append(match_stage)

    gross_pipeline += [
        {"$match": {"status": {"$in": ["Approved", "Out for Delivery", "Delivered"]}}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": None,
                "gross_revenue": {
                    "$sum": {"$multiply": ["$items.price", "$items.qty"]}
                }
            }
        },
        {"$project": {"_id": 0, "gross_revenue": 1}}
    ]

    gross_result = list(mongo.db.orders.aggregate(gross_pipeline))
    gross_revenue = gross_result[0]["gross_revenue"] if gross_result else 0

    return jsonify({
        "orders": net_data["orders"],
        "gross_revenue": gross_revenue,
        "net_revenue": net_data["net_revenue"],
        "sold_items": net_data["sold_items"]
    })

@admin_analytics_bp.route("/revenue-growth", methods=["GET"])
@login_required(role="admin")
def revenue_growth():
    match_stage = parse_date_range()
    pipeline = []

    if match_stage:
        pipeline.append(match_stage)

    pipeline += [
        {"$match": {"status": "Delivered"}},
        {"$unwind": "$items"},
        {
            "$project": {
                "date": "$created_at",
                "amount": {"$multiply": ["$items.price", "$items.qty"]}
            }
        }
    ]

    data = list(mongo.db.orders.aggregate(pipeline))

    start = request.args.get("start")
    end = request.args.get("end")

    if not start or not end:
        return jsonify({"current": 0, "previous": 0, "growth": 0})

    start_dt = datetime.fromisoformat(start.replace("Z", ""))
    end_dt = datetime.fromisoformat(end.replace("Z", ""))

    range_duration = end_dt - start_dt
    prev_start = start_dt - range_duration
    prev_end = start_dt

    current = sum(d["amount"] for d in data if start_dt <= d["date"] <= end_dt)
    previous = sum(d["amount"] for d in data if prev_start <= d["date"] < prev_end)

    growth = round(((current - previous) / previous) * 100, 2) if previous > 0 else 0

    return jsonify({
        "current": current,
        "previous": previous,
        "growth": growth
    })

@admin_analytics_bp.route("/sales-trend", methods=["GET"])
@login_required(role="admin")
def sales_trend():
    match_stage = parse_date_range()
    pipeline = []

    if match_stage:
        pipeline.append(match_stage)

    pipeline += [
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
    match_stage = parse_date_range()
    pipeline = []

    if match_stage:
        pipeline.append(match_stage)

    pipeline += [
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
    match_stage = parse_date_range()
    pipeline = []

    if match_stage:
        pipeline.append(match_stage)

    pipeline += [
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
        },
        {"$sort": {"revenue": -1}}
    ]

    data = list(mongo.db.orders.aggregate(pipeline))

    return jsonify([
        {"category": d["_id"], "revenue": d["revenue"]}
        for d in data
    ])
