// Use web-compatible database service for web, SQLite for mobile
let DatabaseService;

if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  // Web environment with localStorage support
  DatabaseService = require('./DatabaseService.web').default;
} else {
  // Mobile environment (React Native)
  DatabaseService = require('./DatabaseService.mobile').default;
}

export default DatabaseService;
