from flask import Blueprint, jsonify, request, session
from bson.objectid import ObjectId
from datetime import datetime, timedelta
from extension import mongo
from utils import login_required
from routes.utils import MEMBERSHIP_PLANS

membership_bp = Blueprint("membership", __name__, url_prefix="/api/membership")

@membership_bp.route("/buy", methods=["POST"])
@login_required()
def buy_membership():

    data = request.get_json()
    plan = data.get("plan")

    if plan not in MEMBERSHIP_PLANS:
        return jsonify({"message": "Invalid membership plan"}), 400

    config = MEMBERSHIP_PLANS[plan]

    expiry = datetime.utcnow() + timedelta(days=config["duration_days"])

    mongo.db.users.update_one(
        {"_id": ObjectId(session["user_id"])},
        {
            "$set": {
                "membership": {
                    "plan": plan,
                    "discount": config["discount"],
                    "free_shipping": config["free_shipping"],
                    "early_campaign_hours": config["early_campaign_hours"],
                    "expires_at": expiry
                }
            }
        }
    )

    return jsonify({
        "success": True,
        "plan": plan,
        "expires_at": expiry.isoformat()
    })
