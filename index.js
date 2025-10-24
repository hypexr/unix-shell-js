// Unix Shell JS - Browser-based Unix/Linux Command Emulator
// Main entry point for the library

class UnixShell {
    constructor(options = {}) {
        // Options: fileSystem, username, customCommands, persistence
        const {
            fileSystem,
            username = 'user',
            customCommands = {},
            persistence = null  // { enabled: true, prefix: 'unixshell' }
        } = options;

        // Set up persistence configuration
        this.persistence = persistence;
        if (this.persistence && this.persistence.enabled) {
            this.persistencePrefix = this.persistence.prefix || 'unixshell';

            // Try to load from localStorage if persistence is enabled
            const loaded = this.loadFromStorage();
            if (loaded) {
                // Successfully loaded from storage
                this.fileSystem = loaded.fileSystem;
                this.currentUser = loaded.currentUser;
                this.currentPath = loaded.currentPath;
            } else {
                // No saved data or loading failed, use provided or default
                this.fileSystem = fileSystem || this.createDefaultFileSystem(username);
                this.currentUser = username;
                this.currentPath = `/home/${username}`;
            }
        } else {
            // No persistence, use provided or default
            this.fileSystem = fileSystem || this.createDefaultFileSystem(username);
            this.currentUser = username;
            this.currentPath = `/home/${username}`;
        }

        // User stack for exit command (don't persist this)
        this.userStack = [];

        this.environment = {
            'USER': this.currentUser,
            'HOME': `/home/${this.currentUser}`,
            'PWD': this.currentPath,
            'PATH': '/usr/local/bin:/usr/bin:/bin',
            'SHELL': '/bin/bash'
        };
        this.commandHistory = [];

        // Piped output flag
        this._isPiped = false;

        // Initialize commands with custom commands
        this.initializeCommands(customCommands);
    }

    createDefaultFileSystem(username) {
        // Minimal default filesystem with just a few example files
        return {
            '/': {
                'home': {
                    [username]: {
                        'README.md': '# Welcome\n\nThis is a simple Unix shell emulator.\n',
                        'example.txt': 'This is an example file.\n'
                    }
                },
                'etc': {
                    'hostname': 'localhost\n'
                },
                'tmp': {}
            }
        };
    }

    // LocalStorage persistence methods
    loadFromStorage() {
        if (typeof localStorage === 'undefined') {
            return null;
        }

        try {
            const fsKey = `${this.persistencePrefix}_filesystem`;
            const userKey = `${this.persistencePrefix}_current_user`;
            const pathKey = `${this.persistencePrefix}_current_path`;

            const savedFS = localStorage.getItem(fsKey);
            const savedUser = localStorage.getItem(userKey);
            const savedPath = localStorage.getItem(pathKey);

            if (!savedFS || !savedUser || !savedPath) {
                return null;
            }

            const fileSystem = JSON.parse(savedFS);

            // Validate filesystem structure
            if (!fileSystem['/']) {
                console.warn('Invalid filesystem structure in localStorage - missing root');
                return null;
            }

            // Validate that the saved path exists in the filesystem
            const pathParts = savedPath.split('/').filter(p => p);
            let current = fileSystem['/'];
            for (const part of pathParts) {
                if (!current || typeof current !== 'object' || !(part in current)) {
                    console.warn('Invalid filesystem structure in localStorage - saved path does not exist:', savedPath);
                    return null;
                }
                current = current[part];
            }

            return {
                fileSystem: fileSystem,
                currentUser: savedUser,
                currentPath: savedPath
            };
        } catch (e) {
            console.error('Error loading from localStorage:', e);
            return null;
        }
    }

    saveToStorage() {
        if (!this.persistence || !this.persistence.enabled || typeof localStorage === 'undefined') {
            return;
        }

        try {
            const fsKey = `${this.persistencePrefix}_filesystem`;
            const userKey = `${this.persistencePrefix}_current_user`;
            const pathKey = `${this.persistencePrefix}_current_path`;

            localStorage.setItem(fsKey, JSON.stringify(this.fileSystem));
            localStorage.setItem(userKey, this.currentUser);
            localStorage.setItem(pathKey, this.currentPath);
        } catch (e) {
            console.error('Error saving to localStorage:', e);
        }
    }

    clearStorage() {
        if (!this.persistence || !this.persistence.enabled || typeof localStorage === 'undefined') {
            return;
        }

        try {
            const fsKey = `${this.persistencePrefix}_filesystem`;
            const userKey = `${this.persistencePrefix}_current_user`;
            const pathKey = `${this.persistencePrefix}_current_path`;

            localStorage.removeItem(fsKey);
            localStorage.removeItem(userKey);
            localStorage.removeItem(pathKey);
        } catch (e) {
            console.error('Error clearing localStorage:', e);
        }
    }

    initializeCommands(customCommands) {
        // Built-in commands
        this.commands = {
            help: this.cmd_help.bind(this),
            ls: this.cmd_ls.bind(this),
            cd: this.cmd_cd.bind(this),
            pwd: this.cmd_pwd.bind(this),
            cat: this.cmd_cat.bind(this),
            echo: this.cmd_echo.bind(this),
            clear: this.cmd_clear.bind(this),
            whoami: this.cmd_whoami.bind(this),
            date: this.cmd_date.bind(this),
            uname: this.cmd_uname.bind(this),
            env: this.cmd_env.bind(this),
            history: this.cmd_history.bind(this),
            mkdir: this.cmd_mkdir.bind(this),
            touch: this.cmd_touch.bind(this),
            rm: this.cmd_rm.bind(this),
            tree: this.cmd_tree.bind(this),
            ps: this.cmd_ps.bind(this),
            vi: this.cmd_vi.bind(this),
            vim: this.cmd_vim.bind(this),
            su: this.cmd_su.bind(this),
            sudo: this.cmd_sudo.bind(this),
            exit: this.cmd_exit.bind(this)
        };

        // Add custom commands (these will overwrite built-in commands if same name)
        for (const [name, handler] of Object.entries(customCommands)) {
            this.commands[name] = handler.bind(this);
        }
    }

    // Helper: Navigate filesystem
    resolvePath(path) {
        // Expand ~ to home directory
        if (path.startsWith('~')) {
            path = this.environment.HOME + path.slice(1);
        }

        if (path.startsWith('/')) {
            return path;
        }
        const parts = this.currentPath.split('/').filter(p => p);
        const newParts = path.split('/').filter(p => p);

        for (const part of newParts) {
            if (part === '..') {
                parts.pop();
            } else if (part !== '.') {
                parts.push(part);
            }
        }
        return '/' + parts.join('/');
    }

    getNode(path) {
        const fullPath = this.resolvePath(path);
        const parts = fullPath.split('/').filter(p => p);
        let current = this.fileSystem['/'];

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return null;
            }
        }
        return current;
    }

    // Get owner of a file/directory based on path
    getOwner(path) {
        if (path.startsWith(`/home/${this.currentUser}`) || path === `/home/${this.currentUser}`) {
            return { user: this.currentUser, group: this.currentUser };
        }
        return { user: 'root', group: 'root' };
    }

    // Check if current user has write permission to a path
    canWrite(path) {
        // Root can write anywhere
        if (this.currentUser === 'root') {
            return true;
        }

        // Regular user can only write in their home directory
        const fullPath = this.resolvePath(path);
        return fullPath.startsWith(`/home/${this.currentUser}`);
    }

    // Command implementations
    cmd_help() {
        const commandList = Object.keys(this.commands).sort();
        return `Available commands:\n${commandList.map(cmd => `  ${cmd}`).join('\n')}\n\nType any command to try it out!`;
    }

    cmd_ls(args) {
        // Parse flags and path
        let showHidden = false;
        let longFormat = false;
        let humanReadable = false;
        let targetPath = null;

        for (const arg of args) {
            if (arg.startsWith('-')) {
                // Parse flags
                if (arg.includes('a')) showHidden = true;
                if (arg.includes('l')) longFormat = true;
                if (arg.includes('h')) humanReadable = true;
            } else {
                targetPath = arg;
            }
        }

        const path = targetPath || this.currentPath;
        const node = this.getNode(path);

        if (node === null || node === undefined) {
            return `ls: cannot access '${targetPath || '.'}': No such file or directory`;
        }

        if (typeof node === 'string') {
            return targetPath || '.';
        }

        let entries = Object.keys(node);

        // Filter hidden files unless -a is specified
        if (!showHidden) {
            entries = entries.filter(name => !name.startsWith('.'));
        }

        if (entries.length === 0) {
            return '';
        }

        // Sort entries (directories first, then alphabetically)
        entries.sort((a, b) => {
            const aIsDir = typeof node[a] === 'object';
            const bIsDir = typeof node[b] === 'object';

            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b);
        });

        if (longFormat) {
            // Long format listing
            return entries.map(name => {
                const isDir = typeof node[name] === 'object';
                const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
                const links = isDir ? '2' : '1';

                // Determine ownership based on file path
                const filePath = path === '/' ? `/${name}` : `${path}/${name}`;
                const owner = this.getOwner(filePath);
                const user = owner.user;
                const group = owner.group;

                let size;
                if (isDir) {
                    size = '4096';
                } else {
                    const bytes = node[name].length;
                    if (humanReadable) {
                        if (bytes < 1024) size = bytes + 'B';
                        else if (bytes < 1024 * 1024) size = Math.round(bytes / 1024) + 'K';
                        else size = Math.round(bytes / (1024 * 1024)) + 'M';
                    } else {
                        size = bytes.toString();
                    }
                }

                const date = new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                return `${perms} ${links} ${user.padEnd(8)} ${group.padEnd(8)} ${size.padStart(humanReadable ? 5 : 8)} ${date} ${name}`;
            }).join('\n');
        } else {
            // Simple format
            const formatted = entries.map(name => {
                const isDir = typeof node[name] === 'object';
                return isDir ? `${name}/` : name;
            });

            // If output is being piped, use one per line
            // Otherwise, use columns (space-separated)
            if (this._isPiped) {
                return formatted.join('\n');
            } else {
                // Multi-column output for terminal display
                return formatted.join('  ');
            }
        }
    }

    cmd_cd(args) {
        if (!args[0]) {
            this.currentPath = this.environment.HOME;
            this.environment.PWD = this.currentPath;
            return '';
        }

        const newPath = this.resolvePath(args[0]);
        const node = this.getNode(newPath);

        if (node === null || node === undefined) {
            return `cd: ${args[0]}: No such file or directory`;
        }

        if (typeof node === 'string') {
            return `cd: ${args[0]}: Not a directory`;
        }

        this.currentPath = newPath;
        this.environment.PWD = this.currentPath;
        return '';
    }

    cmd_pwd() {
        return this.currentPath;
    }

    cmd_cat(args) {
        if (!args[0]) {
            return 'cat: missing file operand';
        }

        const node = this.getNode(args[0]);

        if (node === null || node === undefined) {
            return `cat: ${args[0]}: No such file or directory`;
        }

        if (typeof node !== 'string') {
            return `cat: ${args[0]}: Is a directory`;
        }

        return node;
    }

    cmd_echo(args) {
        // Join arguments and remove surrounding quotes
        const text = args.join(' ');
        // Remove surrounding single or double quotes
        return text.replace(/^["']|["']$/g, '');
    }

    cmd_clear() {
        return '__CLEAR__';
    }

    cmd_whoami() {
        return this.environment.USER;
    }

    cmd_date() {
        return new Date().toString();
    }

    cmd_uname(args) {
        if (args.includes('-a')) {
            return 'UnixShell 1.0.0 UnixShell Terminal x86_64 GNU/JavaScript';
        }
        return 'UnixShell';
    }

    cmd_env() {
        return Object.entries(this.environment)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
    }

    cmd_history() {
        return this.commandHistory
            .map((cmd, i) => `${i + 1}  ${cmd}`)
            .join('\n');
    }

    cmd_mkdir(args) {
        if (!args[0]) {
            return 'mkdir: missing operand';
        }

        const path = this.resolvePath(args[0]);

        // Check write permission
        if (!this.canWrite(path)) {
            return `mkdir: cannot create directory '${args[0]}': Permission denied`;
        }

        const parts = path.split('/').filter(p => p);
        const dirName = parts.pop();
        const parentPath = '/' + parts.join('/');
        const parent = this.getNode(parentPath);

        if (!parent) {
            return `mkdir: cannot create directory '${args[0]}': No such file or directory`;
        }

        if (typeof parent !== 'object') {
            return `mkdir: cannot create directory '${args[0]}': Not a directory`;
        }

        if (dirName in parent) {
            return `mkdir: cannot create directory '${args[0]}': File exists`;
        }

        parent[dirName] = {};
        return '';
    }

    cmd_touch(args) {
        if (!args[0]) {
            return 'touch: missing file operand';
        }

        const path = this.resolvePath(args[0]);

        // Check write permission
        if (!this.canWrite(path)) {
            return `touch: cannot touch '${args[0]}': Permission denied`;
        }

        const parts = path.split('/').filter(p => p);
        const fileName = parts.pop();
        const parentPath = '/' + parts.join('/');
        const parent = this.getNode(parentPath);

        if (!parent) {
            return `touch: cannot touch '${args[0]}': No such file or directory`;
        }

        if (typeof parent !== 'object') {
            return `touch: cannot touch '${args[0]}': Not a directory`;
        }

        if (!(fileName in parent)) {
            parent[fileName] = '';
        }
        return '';
    }

    cmd_rm(args) {
        if (!args[0]) {
            return 'rm: missing operand';
        }

        // Parse flags
        let recursive = false;
        let force = false;
        let verbose = false;
        const targets = [];

        for (const arg of args) {
            if (arg.startsWith('-')) {
                if (arg.includes('r') || arg.includes('R')) recursive = true;
                if (arg.includes('f')) force = true;
                if (arg.includes('v')) verbose = true;
            } else {
                targets.push(arg);
            }
        }

        if (targets.length === 0) {
            return 'rm: missing operand';
        }

        const errors = [];
        const removed = [];

        // Process each target
        for (const target of targets) {
            const path = this.resolvePath(target);
            const parts = path.split('/').filter(p => p);
            const fileName = parts.pop();
            const parentPath = '/' + parts.join('/');
            const parent = this.getNode(parentPath);

            // Check write permission
            if (!this.canWrite(parentPath)) {
                errors.push(`rm: cannot remove '${target}': Permission denied`);
                continue;
            }

            if (!parent || !(fileName in parent)) {
                if (!force) {
                    errors.push(`rm: cannot remove '${target}': No such file or directory`);
                }
                continue;
            }

            const isDir = typeof parent[fileName] === 'object';

            if (isDir && !recursive) {
                if (!force) {
                    errors.push(`rm: cannot remove '${target}': Is a directory`);
                }
                continue;
            }

            delete parent[fileName];
            if (verbose) {
                removed.push(`removed '${target}'`);
            }
        }

        // Build output
        let output = '';
        if (verbose && removed.length > 0) {
            output = removed.join('\n');
        }
        if (errors.length > 0) {
            if (output) output += '\n';
            output += errors.join('\n');
        }

        return output;
    }

    cmd_tree() {
        const buildTree = (node, prefix = '', isLast = true) => {
            let result = '';
            const entries = Object.entries(node);

            entries.forEach(([name, value], index) => {
                const isLastEntry = index === entries.length - 1;
                const connector = isLastEntry ? '└── ' : '├── ';
                const isDir = typeof value === 'object';

                result += prefix + connector + name + (isDir ? '/\n' : '\n');

                if (isDir) {
                    const newPrefix = prefix + (isLastEntry ? '    ' : '│   ');
                    result += buildTree(value, newPrefix, isLastEntry);
                }
            });

            return result;
        };

        const node = this.getNode(this.currentPath);
        return this.currentPath + '/\n' + buildTree(node);
    }

    cmd_ps(args) {
        // Basic ps command - shows minimal process list
        // Can be overridden by custom commands for more detailed output

        // Base processes
        const processes = [
            { pid: 1, user: 'root', tty: '?', time: '0:01', cmd: 'init' },
            { pid: 100, user: this.currentUser, tty: 'pts/0', time: '0:00', cmd: 'bash' },
            { pid: 101, user: this.currentUser, tty: 'pts/0', time: '0:00', cmd: 'ps' }
        ];

        // Simple output format
        let output = '  PID TTY          TIME CMD\n';
        processes.forEach(p => {
            output += `${String(p.pid).padStart(5)} ${p.tty.padEnd(12)} ${p.time.padStart(8)} ${p.cmd}\n`;
        });

        return output;
    }

    cmd_vi(args) {
        return this.openEditor(args[0] || 'untitled');
    }

    cmd_vim(args) {
        return this.openEditor(args[0] || 'untitled');
    }

    cmd_su(args) {
        const targetUser = args[0] || 'root';

        // Push current user to stack before switching
        this.userStack.push({
            user: this.currentUser,
            home: this.environment.HOME,
            path: this.currentPath
        });

        this.currentUser = targetUser;
        this.environment.USER = targetUser;
        this.environment.HOME = targetUser === 'root' ? '/root' : `/home/${targetUser}`;

        // Keep current directory (don't change to home)
        this.environment.PWD = this.currentPath;

        return `__USER_SWITCHED__:${targetUser}`;
    }

    cmd_sudo(args) {
        // Handle "sudo su" specifically
        if (args[0] === 'su') {
            return this.cmd_su(args.slice(1));
        }

        // For other sudo commands, just run as current user
        const command = args[0];
        const cmdArgs = args.slice(1);

        if (command in this.commands) {
            return this.commands[command](cmdArgs);
        } else {
            return `sudo: ${command}: command not found`;
        }
    }

    cmd_exit() {
        // Pop the previous user from the stack
        if (this.userStack.length === 0) {
            return 'exit: no other user session to return to';
        }

        const previousUser = this.userStack.pop();
        this.currentUser = previousUser.user;
        this.environment.USER = previousUser.user;
        this.environment.HOME = previousUser.home;
        this.currentPath = previousUser.path;
        this.environment.PWD = this.currentPath;

        return `__USER_SWITCHED__:${previousUser.user}`;
    }

    execute(commandLine) {
        if (!commandLine.trim()) {
            return '';
        }

        // Add to history
        this.commandHistory.push(commandLine);

        // Check for pipe to grep
        let grepPattern = null;
        let grepFlags = { ignoreCase: false, invert: false };
        let actualCommand = commandLine;

        const pipeIndex = commandLine.indexOf('|');
        if (pipeIndex !== -1) {
            const beforePipe = commandLine.substring(0, pipeIndex).trim();
            const afterPipe = commandLine.substring(pipeIndex + 1).trim();

            if (afterPipe.startsWith('grep ') || afterPipe === 'grep') {
                actualCommand = beforePipe;
                const grepCommand = afterPipe.substring(4).trim();

                let grepArgs = grepCommand;
                const redirectMatch = grepCommand.match(/^(.+?)\s*>>?\s*.+$/);
                if (redirectMatch) {
                    grepArgs = redirectMatch[1].trim();
                    commandLine = beforePipe + ' ' + grepCommand.substring(grepArgs.length);
                }

                const grepParts = grepArgs.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];

                for (let i = 0; i < grepParts.length; i++) {
                    const part = grepParts[i];
                    if (part === '-i') {
                        grepFlags.ignoreCase = true;
                    } else if (part === '-v') {
                        grepFlags.invert = true;
                    } else if (!grepPattern) {
                        grepPattern = part.replace(/^["']|["']$/g, '');
                    }
                }
            }
        }

        // Check for output redirection
        let redirectMode = null;
        let redirectFile = null;

        const appendMatch = commandLine.match(/^(.+?)\s*>>\s*(.+)$/);
        const overwriteMatch = commandLine.match(/^(.+?)\s*>\s*(.+)$/);

        if (appendMatch) {
            redirectMode = 'append';
            actualCommand = appendMatch[1].trim();
            redirectFile = appendMatch[2].trim();
        } else if (overwriteMatch) {
            redirectMode = 'overwrite';
            actualCommand = overwriteMatch[1].trim();
            redirectFile = overwriteMatch[2].trim();
        }

        // Parse command and arguments
        const parts = actualCommand.trim().split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);

        // Execute the command
        let output = '';
        if (command in this.commands) {
            try {
                this._isPiped = (grepPattern !== null);
                output = this.commands[command](args);
                this._isPiped = false;
            } catch (error) {
                return `Error executing ${command}: ${error.message}`;
            }
        } else {
            return `${command}: command not found`;
        }

        // Apply grep filter if present
        if (grepPattern !== null && output) {
            const lines = output.split('\n');
            const filtered = lines.filter(line => {
                let matches;
                if (grepFlags.ignoreCase) {
                    matches = line.toLowerCase().includes(grepPattern.toLowerCase());
                } else {
                    matches = line.includes(grepPattern);
                }
                return grepFlags.invert ? !matches : matches;
            });
            output = filtered.join('\n');
            if (output.endsWith('\n\n')) {
                output = output.slice(0, -1);
            }
        }

        // Handle redirection
        if (redirectMode && redirectFile) {
            const writeResult = this.writeToFile(redirectFile, output, redirectMode);
            if (writeResult) {
                return writeResult;
            }
            // Save to storage after file write
            this.saveToStorage();
            return '';
        }

        // Save to storage after command execution (if persistence is enabled)
        this.saveToStorage();

        return output;
    }

    writeToFile(filePath, content, mode) {
        const fullPath = this.resolvePath(filePath);
        const parts = fullPath.split('/').filter(p => p);
        const fileName = parts.pop();
        const parentPath = '/' + parts.join('/');
        const parent = this.getNode(parentPath);

        if (!parent) {
            return `bash: ${filePath}: No such file or directory`;
        }

        if (typeof parent !== 'object') {
            return `bash: ${filePath}: Not a directory`;
        }

        if (fileName in parent && typeof parent[fileName] === 'object') {
            return `bash: ${filePath}: Is a directory`;
        }

        if (mode === 'append' && fileName in parent) {
            parent[fileName] += content;
        } else {
            parent[fileName] = content;
        }

        return null;
    }

    getCurrentPath() {
        return this.currentPath;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    openEditor(filename) {
        const fullPath = this.resolvePath(filename);
        const node = this.getNode(fullPath);

        let content = '';
        if (node && typeof node === 'string') {
            content = node;
        }

        const saveCallback = (filename, content) => {
            const result = this.writeToFile(filename, content, 'overwrite');
            return result === null;
        };

        const exitCallback = () => {
            if (window.enableTerminal) {
                window.enableTerminal();
            }
        };

        if (window.disableTerminal) {
            window.disableTerminal();
        }

        if (typeof window !== 'undefined' && window.ViEditor) {
            new window.ViEditor(filename, content, saveCallback, exitCallback);
        }

        return '__VI_OPENED__';
    }

    getCompletions(partial) {
        const parts = partial.trim().split(/\s+/);

        if (parts.length === 1) {
            const prefix = parts[0];
            const commands = Object.keys(this.commands).filter(cmd => cmd.startsWith(prefix));
            return { type: 'command', matches: commands, prefix };
        }

        const pathPrefix = parts[parts.length - 1];
        let searchDir = this.currentPath;
        let filePrefix = pathPrefix;

        if (pathPrefix.includes('/')) {
            const lastSlash = pathPrefix.lastIndexOf('/');
            const dirPart = pathPrefix.substring(0, lastSlash + 1);
            filePrefix = pathPrefix.substring(lastSlash + 1);
            searchDir = this.resolvePath(dirPart);
        }

        const node = this.getNode(searchDir);
        if (!node || typeof node !== 'object') {
            return { type: 'path', matches: [], prefix: pathPrefix };
        }

        const matches = Object.keys(node)
            .filter(name => name.startsWith(filePrefix))
            .map(name => {
                const isDir = typeof node[name] === 'object';
                return isDir ? name + '/' : name;
            });

        return { type: 'path', matches, prefix: pathPrefix, filePrefix };
    }
}

// Make available in browser
if (typeof window !== 'undefined') {
    window.UnixShell = UnixShell;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnixShell;
}
