from datetime import datetime
from flask import request
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

    campaign = mongo.db.campaigns.find_one({
        "product_id": product["_id"],
        "start": {"$lte": now},
        "end": {"$gte": now}
    })

    original_price = float(product["price"])

    product["original_price"] = original_price
    product["offer_price"] = None
    product["discount_percent"] = 0
    product["is_discount_active"] = False
    product["final_price"] = original_price

    if campaign:
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

    return product
