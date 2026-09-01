/**
 * cPanel Application Startup File
 * 
 * This file serves as the main entry point for cPanel's Node.js (Phusion Passenger) application server.
 * It loads the bundled production server from the compiled `dist/server.cjs` file.
 */

// Load the bundled production server
require('./dist/server.cjs');
