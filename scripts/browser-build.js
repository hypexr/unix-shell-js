#!/usr/bin/env node

/**
 * Post-build script to make compiled TypeScript work in browsers
 * Wraps the CommonJS output in an IIFE that provides module/exports
 */

const fs = require('fs');
const path = require('path');

const files = ['index.js', 'vi-editor.js', 'example-files.js'];
const distDir = path.join(__dirname, '..', 'dist');

files.forEach(filename => {
    const filepath = path.join(distDir, filename);
    const content = fs.readFileSync(filepath, 'utf8');

    // Wrap in IIFE that provides module and exports
    const wrapped = `(function() {
    var exports = {};
    var module = { exports: exports };

${content}

    // Module is now in module.exports, but window assignments already happened
})();
`;

    fs.writeFileSync(filepath, wrapped, 'utf8');
    console.log(`Wrapped ${filename} for browser compatibility`);
});

console.log('Browser build complete!');
