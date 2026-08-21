'use strict';

async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ai_favorites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      message_id BIGINT NOT NULL,
      session_id TEXT,
      content TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, message_id)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_favorites_user ON ai_favorites(user_id, created_at DESC)`);
}

module.exports = { up };
