from datetime import datetime, timedelta
from flask import request, session
from bson.objectid import ObjectId
from extension import mongo
import re

def title_case(text):
    if not text:
        return text

    words = text.strip().split()
    formatted = []

    for word in words:
        if word.isupper() and len(word) > 1:
            formatted.append(word)
        else:
            formatted.append(word[0].upper() + word[1:].lower() if len(word) > 1 else word.upper())

    return " ".join(formatted)

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def parse_date_range():
    start = request.args.get("start")
    end = request.args.get("end")

    if not start or not end:
        return None

    return {
        "$match": {
            "created_at": {
                "$gte": datetime.fromisoformat(start.replace("Z", "")),
                "$lte": datetime.fromisoformat(end.replace("Z", ""))
            }
        }
    }

def apply_campaign_discount(product):

    now = datetime.utcnow()

    user_id = session.get("user_id")
    membership = None

    if user_id:
        user = mongo.db.users.find_one(
            {"_id": ObjectId(user_id)},
            {"membership": 1}
        )
        membership = user.get("membership") if user else None

    campaign = mongo.db.campaigns.find_one({
        "product_id": product["_id"],
        "end": {"$gte": now}
    })

    original_price = float(product["price"])

    product["original_price"] = original_price
    product["offer_price"] = None
    product["discount_percent"] = 0
    product["is_discount_active"] = False
    product["final_price"] = original_price

    if campaign:

        start_time = campaign["start"]

        early_hours = 0

        if membership:
            expiry = membership.get("expires_at")

            if expiry and expiry > now:
                early_hours = membership.get("early_campaign_hours", 0)

        campaign_visible = False

        if now >= start_time:
            campaign_visible = True
        else:
            if early_hours > 0:
                early_start = start_time - timedelta(hours=early_hours)
                if now >= early_start:
                    campaign_visible = True

        if campaign_visible:

            discount = float(campaign.get("discount_percent", 0))

            if discount > 0:
                offer_price = round(
                    original_price * (1 - discount / 100),
                    2
                )

                product["offer_price"] = offer_price
                product["final_price"] = offer_price
                product["discount_percent"] = discount
                product["is_discount_active"] = True

    if membership:

        expiry = membership.get("expires_at")

        if expiry and expiry > now:

            discount = float(membership.get("discount", 0))

            if discount > 0:
                product["final_price"] = round(
                    product["final_price"] * (1 - discount / 100),
                    2
                )

                product["member_discount"] = discount
                product["membership_plan"] = membership.get("plan")

    return product

MEMBERSHIP_PLANS = {
    "silver": {
        "price": 199,
        "duration_days": 30,
        "discount": 3,
        "free_shipping": False,
        "early_campaign_hours": 0
    },
    "gold": {
        "price": 499,
        "duration_days": 90,
        "discount": 5,
        "free_shipping": True,
        "early_campaign_hours": 0
    },
    "platinum": {
        "price": 999,
        "duration_days": 365,
        "discount": 10,
        "free_shipping": True,
        "early_campaign_hours": 12
    }
}
