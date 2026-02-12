from functools import wraps
from flask import session, jsonify

def login_user(user):
    session["user_id"] = str(user["_id"])
    session["role"] = user.get("role", "user")
    session["logged_in"] = True

def logout_user():
    session.clear()

def login_required(role=None):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):

            if not session.get("logged_in"):
                return jsonify({"message": "Login required"}), 401

            if role and session.get("role") != role:
                return jsonify({"message": "Access denied"}), 403

            return fn(*args, **kwargs)

        return wrapper
    return decorator
