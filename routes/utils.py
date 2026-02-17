from datetime import datetime
from flask import request
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
