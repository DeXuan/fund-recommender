// Simplified DB module for Termux without PostgreSQL
// User auth and portfolio features will be disabled

const noop = () => {};
const mockPool = {
  connect: async () => ({
    query: async () => ({ rows: [] }),
    release: noop,
  }),
  query: async () => ({ rows: [] }),
  on: noop,
  end: async () => {},
};

async function initDatabase() {
  console.log('[Termux] PostgreSQL not available, running in read-only mode');
  console.log('[Termux] User auth and portfolio features are disabled');
}

function getPool() {
  return mockPool;
}

module.exports = { initDatabase, getPool };
