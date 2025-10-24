(function() {
    var exports = {};
    var module = { exports: exports };

"use strict";
// Example file structure for user's home directory
// These are minimal example files that can be used to populate the filesystem
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExampleFiles = createExampleFiles;
/**
 * Creates an example filesystem structure with sample files
 * @param username - The username to create the home directory for
 * @returns A complete filesystem structure with example files
 */
function createExampleFiles(username = 'user') {
    return {
        '/': {
            'home': {
                [username]: {
                    'README.md': `# Welcome to Unix Shell JS

This is a browser-based Unix shell emulator.

## Available Commands

Type \`help\` to see all available commands.

## Examples

- \`ls -la\` - List all files including hidden ones
- \`cat example.txt\` - Display file contents
- \`mkdir mydir\` - Create a new directory
- \`cd mydir\` - Change to that directory
- \`vim file.txt\` - Edit a file with the vi editor

Have fun!
`,
                    'example.txt': `This is an example text file.

You can view this with: cat example.txt
You can edit it with: vim example.txt

Try creating your own files with touch or vim!
`,
                    'notes.txt': `Development Notes
==================

- Project started on ${new Date().toISOString().split('T')[0]}
- This is a minimal Unix shell emulator
- Add your own notes here!
`
                }
            },
            'etc': {
                'hostname': 'localhost\n',
                'motd': 'Welcome to Unix Shell JS!\n\nType "help" for available commands.\n'
            },
            'tmp': {}
        }
    };
}
// Make available in browser
if (typeof window !== 'undefined') {
    window.createExampleFiles = createExampleFiles;
}
// Export for Node.js/npm
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createExampleFiles };
}
//# sourceMappingURL=example-files.js.map

    // Module is now in module.exports, but window assignments already happened
})();
