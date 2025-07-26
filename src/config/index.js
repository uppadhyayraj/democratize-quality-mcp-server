const path = require('path');
module.exports = {
    PORT: process.env.PORT || 3000,
    OUTPUT_DIR: path.resolve(__dirname, '../../output'), // Directory to save screenshots and other outputs
    // We will add other configurations here later, e.g., default browser flags, timeouts
};
