-- PostgreSQL schema for GTA (Game Tracking App)

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    avatar_url TEXT,
    bio TEXT
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    release_date DATE,
    developer TEXT,
    publisher TEXT,
    cover_image_url TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User Game Ratings table
CREATE TABLE IF NOT EXISTS user_game_ratings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 10),
    review TEXT,
    status TEXT CHECK (status IN ('played', 'playing', 'want_to_play', 'dropped')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
    UNIQUE (user_id, game_id)
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Game Tags table
CREATE TABLE IF NOT EXISTS game_tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- Game-Tag relationship table
CREATE TABLE IF NOT EXISTS game_tag_relations (
    game_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (game_id, tag_id),
    FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES game_tags (id) ON DELETE CASCADE
);

-- User Follows table (for users following other users)
CREATE TABLE IF NOT EXISTS user_follows (
    follower_id INTEGER NOT NULL,
    followed_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (follower_id, followed_id),
    FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (followed_id) REFERENCES users (id) ON DELETE CASCADE,
    CHECK (follower_id != followed_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_game_ratings_user_id ON user_game_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_game_ratings_game_id ON user_game_ratings(game_id);
CREATE INDEX IF NOT EXISTS idx_game_tag_relations_game_id ON game_tag_relations(game_id);
CREATE INDEX IF NOT EXISTS idx_game_tag_relations_tag_id ON game_tag_relations(tag_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id); 