import os
import json
from dotenv import load_dotenv
from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
from googleapiclient.discovery import build
from player_core import MusicPlayer

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['DOWNLOAD_FOLDER'] = 'downloads'

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login_page'
player = MusicPlayer()

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    is_subscribed = db.Column(db.Boolean, default=False)
    playlists = db.relationship('Playlist', backref='owner', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Playlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route("/")
def home():
    return render_template("index.html")

@app.route('/login_page')
def login_page():
    return render_template('login.html')

@app.route('/signup_page')
def signup_page():
    return render_template('signup.html')

@app.route('/subscribe_page')
@login_required
def subscribe_page():
    return render_template('subscribe.html')

@app.route('/account_page')
@login_required
def account_page():
    return render_template('account.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(username=data.get('username')).first():
        return jsonify({"message": "Username already exists"}), 409
    new_user = User(username=data.get('username'))
    new_user.set_password(data.get('password'))
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data.get('username')).first()
    if user and user.check_password(data.get('password')):
        login_user(user)
        return jsonify({"message": "Logged in successfully", "is_subscribed": user.is_subscribed, "username": user.username}), 200
    return jsonify({"message": "Invalid credentials"}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200

@app.route('/api/subscribe', methods=['POST'])
@login_required
def subscribe():
    current_user.is_subscribed = True
    db.session.commit()
    return jsonify({"message": "Subscription successful!"}), 200
    
@app.route('/api/account/update', methods=['POST'])
@login_required
def update_account():
    data = request.json
    new_username, new_password = data.get('username'), data.get('password')
    if new_username:
        if User.query.filter(User.id != current_user.id, User.username == new_username).first():
            return jsonify({"error": "Username already taken"}), 409
        current_user.username = new_username
    if new_password:
        current_user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Account updated successfully!"}), 200

@app.route('/api/playlists')
def get_playlists():
    try:
        with open('static/playlists.json', 'r', encoding='utf-8') as f:
            playlists = json.load(f)
        return jsonify(playlists)
    except FileNotFoundError:
        return jsonify([])

@app.route('/api/playlists/create', methods=['POST'])
@login_required
def create_playlist():
    playlist_name = request.json.get('name')
    if not playlist_name:
        return jsonify({"error": "Playlist name is required"}), 400
    new_playlist = Playlist(name=playlist_name, owner=current_user)
    db.session.add(new_playlist)
    db.session.commit()
    return jsonify({"message": f"Playlist '{playlist_name}' created successfully!"}), 201

@app.route("/api/search", methods=['GET'])
def search_music():
    query = request.args.get('query')
    search_response = youtube.search().list(q=query, part='snippet', maxResults=10, type='video', videoCategoryId='10').execute()
    results = [{'videoId': item['id']['videoId'], 'title': item['snippet']['title'], 'artist': item['snippet']['channelTitle'], 'thumbnail': item['snippet']['thumbnails']['default']['url']} for item in search_response.get('items', [])]
    return jsonify(results)

@app.route("/api/queue", methods=['GET'])
def get_queue(): return jsonify(player.playback_queue.to_list_of_dicts())
@app.route("/api/queue/add", methods=['POST'])
def add_to_queue():
    player.playback_queue.append(request.json); return jsonify({"message": "Song added successfully!"}), 201
@app.route("/api/queue/move", methods=['POST'])
def move_in_queue():
    player.playback_queue.move(request.json.get('fromIndex'), request.json.get('toIndex')); return jsonify({"message": "Queue updated"}), 200

if __name__ == "__main__":
    app.run(debug=True)