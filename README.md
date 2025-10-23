# Unix Shell JS

A browser-based Unix/Linux command emulator with vi editor support.

**[Try the Live Demo](https://hypexr.github.io/unix-shell-js/)**

## Features

- Common Unix commands (ls, cd, cat, mkdir, rm, etc.)
- Vi/Vim editor with modal editing
- Tab completion
- Command history
- Pipe and redirection support
- Customizable filesystem
- Custom command support

## Installation

### Local Development

If you're working locally and want to use this library in another project:

```bash
cd ../unix-shell-js
npm link

cd ../your-project
npm link unix-shell-js
```

### From npm (when published)

```bash
npm install unix-shell-js
```

## Usage

### Basic Setup

Include the library files in your HTML:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Terminal</title>
</head>
<body>
    <script src="node_modules/unix-shell-js/index.js"></script>
    <script src="node_modules/unix-shell-js/vi-editor.js"></script>
    <script src="node_modules/unix-shell-js/example-files.js"></script>
    <script>
        // Create the shell with example files
        const shell = new UnixShell({
            username: 'user',
            fileSystem: createExampleFiles('user')
        });

        // Execute a command
        const output = shell.execute('ls -la');
        console.log(output);
    </script>
</body>
</html>
```

### Initialize with Custom Filesystem

```javascript
const customFS = {
    '/': {
        'home': {
            'myuser': {
                'welcome.txt': 'Hello, world!\n',
                'projects': {
                    'app.js': 'console.log("Hello");\n'
                }
            }
        }
    }
};

const shell = new UnixShell({
    username: 'myuser',
    fileSystem: customFS
});
```

### Enable localStorage Persistence

The library includes built-in localStorage persistence to automatically save and restore the filesystem, current path, and current user across page reloads:

```javascript
const shell = new UnixShell({
    username: 'user',
    fileSystem: createExampleFiles('user'),
    persistence: {
        enabled: true,
        prefix: 'myapp'  // Uses 'myapp_filesystem', 'myapp_current_user', 'myapp_current_path'
    }
});
```

**How it works:**
- When persistence is enabled, the shell automatically loads saved state from localStorage on initialization
- After each command execution, the filesystem and current state are automatically saved
- If no saved data exists, it uses the provided `fileSystem` and `username` options
- Use a custom `prefix` to avoid conflicts with other apps on the same domain

**Clear saved data:**
```javascript
// Clear localStorage for this shell
shell.clearStorage();
```

### Initialize with Custom Commands

```javascript
const customCommands = {
    // Example: ps aux command
    ps: function(args) {
        // Parse flags
        let showAll = false;

        for (const arg of args) {
            if (arg === 'aux' || arg === '-aux') {
                showAll = true;
            }
        }

        const processes = [
            { pid: 1, user: 'root', command: '/sbin/init' },
            { pid: 100, user: this.currentUser, command: '-bash' }
        ];

        if (showAll) {
            processes.push(
                { pid: 50, user: 'root', command: '/usr/sbin/sshd' },
                { pid: 75, user: 'www-data', command: 'nginx' }
            );
        }

        let output = 'USER       PID COMMAND\n';
        processes.forEach(p => {
            output += `${p.user.padEnd(10)} ${String(p.pid).padStart(4)} ${p.command}\n`;
        });

        return output;
    },

    // Example: custom greeting command
    hello: function(args) {
        const name = args[0] || 'World';
        return `Hello, ${name}!`;
    }
};

const shell = new UnixShell({
    username: 'user',
    fileSystem: createExampleFiles('user'),
    customCommands: customCommands
});

// Now you can use your custom commands
console.log(shell.execute('hello Alice')); // Output: Hello, Alice!
console.log(shell.execute('ps aux'));      // Shows process list
```

### Full Example with Terminal UI

```javascript
// Initialize the shell
const shell = new UnixShell({
    username: 'developer',
    fileSystem: createExampleFiles('developer'),
    customCommands: {
        status: function(args) {
            // Example custom command
            return 'System Status: OK\nUptime: 5 days\nLoad: 0.5';
        }
    }
});

// Handle user input
function handleCommand(inputText) {
    const output = shell.execute(inputText);

    // Handle special outputs
    if (output === '__CLEAR__') {
        // Clear the terminal display
        clearTerminal();
    } else if (output === '__VI_OPENED__') {
        // Vi editor was opened
    } else if (output && output.startsWith('__USER_SWITCHED__:')) {
        // User changed (su/sudo command)
        updatePrompt();
    } else {
        // Display normal output
        displayOutput(output);
    }
}
```

## API Reference

### UnixShell Constructor

```javascript
new UnixShell(options)
```

**Options:**
- `fileSystem` (Object): Custom filesystem structure
- `username` (String): Current user name (default: 'user')
- `customCommands` (Object): Custom command handlers
- `persistence` (Object): localStorage persistence configuration
  - `enabled` (Boolean): Enable/disable persistence
  - `prefix` (String): localStorage key prefix (default: 'unixshell')

### Methods

- `execute(commandLine)` - Execute a command and return output
- `getCurrentPath()` - Get current working directory
- `getCurrentUser()` - Get current user
- `getNode(path)` - Get filesystem node at path
- `resolvePath(path)` - Resolve relative/absolute path
- `getCompletions(partial)` - Get tab completion suggestions
- `saveToStorage()` - Manually save state to localStorage (auto-called after commands if persistence enabled)
- `loadFromStorage()` - Load state from localStorage (auto-called during initialization if persistence enabled)
- `clearStorage()` - Clear saved state from localStorage

### Built-in Commands

- `help` - Show available commands
- `ls` - List directory contents
- `cd` - Change directory
- `pwd` - Print working directory
- `cat` - Display file contents
- `echo` - Display text
- `clear` - Clear terminal
- `whoami` - Print current user
- `date` - Display date/time
- `uname` - Print system information
- `env` - Print environment variables
- `history` - Show command history
- `mkdir` - Create directory
- `touch` - Create file
- `rm` - Remove file/directory
- `tree` - Display directory tree
- `ps` - Report process status (basic - can be overridden)
- `vi/vim` - Edit file
- `su` - Switch user
- `sudo` - Execute as superuser
- `exit` - Exit user session

**Note:** All built-in commands can be overridden by providing a custom command with the same name in the `customCommands` option.

## Vi Editor

The library includes a fully functional vi/vim modal editor with:

- Normal, Insert, and Command modes
- Movement keys (hjkl, arrows, 0, $, G)
- Insert commands (i, a, o, O)
- Delete commands (x, dd, dw, d$, etc.)
- Yank and paste (Y, p)
- Save and quit (:w, :q, :wq, :q!)

## License

MIT
