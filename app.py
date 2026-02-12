from flask import Flask, Blueprint
from extension import mongo
from dotenv import load_dotenv
from routes.user import user_bp
from routes.product import product_bp
from routes.category import category_bp
from routes.web import web_bp
from routes.cart import cart_bp
from routes.orders import order_bp
from routes.admin import admin_bp
from routes.wishlist import wishlist_bp
import os

load_dotenv()

app = Flask(__name__)

app.config["MONGO_URI"] = os.getenv("MONGO_URI")
app.secret_key = os.getenv('SECRET_KEY', 'secretkey')

app.register_blueprint(user_bp)
app.register_blueprint(product_bp)
app.register_blueprint(category_bp)
app.register_blueprint(cart_bp)
app.register_blueprint(order_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(web_bp)
app.register_blueprint(wishlist_bp)

mongo.init_app(app)

if __name__=="__main__":
    app.run(debug=True, port=8000)
