// Unix Shell JS - Browser-based Unix/Linux Command Emulator
// Main entry point for the library

/**
 * Represents a file (string) or directory (nested FileSystemNode)
 */
export type FileSystemNode = string | FileSystemDirectory;

/**
 * Directory structure where keys are file/folder names
 */
export interface FileSystemDirectory {
  [key: string]: FileSystemNode;
}

/**
 * Root filesystem structure
 */
export interface FileSystem {
  '/': FileSystemDirectory;
}

/**
 * Persistence configuration options
 */
export interface PersistenceOptions {
  enabled: boolean;
  prefix?: string;
}

/**
 * Options for initializing the Unix Shell
 */
export interface UnixShellOptions {
  fileSystem?: FileSystem;
  username?: string;
  customCommands?: Record<string, CommandHandler>;
  persistence?: PersistenceOptions | null;
}

/**
 * Environment variables
 */
export interface Environment {
  USER: string;
  HOME: string;
  PWD: string;
  PATH: string;
  SHELL: string;
  [key: string]: string;
}

/**
 * Command handler function type
 */
export type CommandHandler = (args: string[]) => string;

/**
 * Commands registry
 */
export interface Commands {
  [command: string]: CommandHandler;
}

/**
 * User state for exit command
 */
interface UserState {
  user: string;
  home: string;
  path: string;
}

/**
 * File owner information
 */
interface FileOwner {
  user: string;
  group: string;
}

/**
 * Grep flags for filtering output
 */
interface GrepFlags {
  ignoreCase: boolean;
  invert: boolean;
}

/**
 * Tab completion result
 */
export interface CompletionResult {
  type: 'command' | 'path';
  matches: string[];
  prefix: string;
  filePrefix?: string;
}

/**
 * Process information for ps command
 */
interface ProcessInfo {
  pid: number;
  user: string;
  tty: string;
  time: string;
  cmd: string;
}

/**
 * Loaded state from localStorage
 */
interface LoadedState {
  fileSystem: FileSystem;
  currentUser: string;
  currentPath: string;
}

/**
 * Main Unix Shell class
 */
export class UnixShell {
  public fileSystem: FileSystem;
  public currentUser: string;
  public currentPath: string;
  public environment: Environment;
  public commandHistory: string[];
  public commands: Commands;

  private persistence: PersistenceOptions | null;
  private persistencePrefix: string;
  private userStack: UserState[];
  private _isPiped: boolean;

  constructor(options: UnixShellOptions = {}) {
    const { fileSystem, username = 'user', customCommands = {}, persistence = null } = options;

    // Set up persistence configuration
    this.persistence = persistence;
    this.persistencePrefix = 'unixshell';

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
      USER: this.currentUser,
      HOME: `/home/${this.currentUser}`,
      PWD: this.currentPath,
      PATH: '/usr/local/bin:/usr/bin:/bin',
      SHELL: '/bin/bash',
    };
    this.commandHistory = [];

    // Piped output flag
    this._isPiped = false;

    // Initialize commands with custom commands
    this.commands = {};
    this.initializeCommands(customCommands);
  }

  /**
   * Creates a default filesystem structure
   */
  createDefaultFileSystem(username: string): FileSystem {
    return {
      '/': {
        home: {
          [username]: {
            'README.md': '# Welcome\n\nThis is a simple Unix shell emulator.\n',
            'example.txt': 'This is an example file.\n',
          },
        },
        etc: {
          hostname: 'localhost\n',
        },
        tmp: {},
      },
    };
  }

  /**
   * Loads shell state from localStorage
   */
  loadFromStorage(): LoadedState | null {
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

      const fileSystem = JSON.parse(savedFS) as FileSystem;

      // Validate filesystem structure
      if (!fileSystem['/']) {
        console.warn('Invalid filesystem structure in localStorage - missing root');
        return null;
      }

      // Validate that the saved path exists in the filesystem
      const pathParts = savedPath.split('/').filter((p) => p);
      let current: FileSystemNode = fileSystem['/'];
      for (const part of pathParts) {
        if (!current || typeof current !== 'object' || !(part in current)) {
          console.warn(
            'Invalid filesystem structure in localStorage - saved path does not exist:',
            savedPath
          );
          return null;
        }
        current = current[part];
      }

      return {
        fileSystem: fileSystem,
        currentUser: savedUser,
        currentPath: savedPath,
      };
    } catch (e) {
      console.error('Error loading from localStorage:', e);
      return null;
    }
  }

  /**
   * Saves shell state to localStorage
   */
  saveToStorage(): void {
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

  /**
   * Clears saved state from localStorage
   */
  clearStorage(): void {
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

  /**
   * Initializes built-in and custom commands
   */
  initializeCommands(customCommands: Record<string, CommandHandler>): void {
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
      exit: this.cmd_exit.bind(this),
    };

    // Add custom commands (these will overwrite built-in commands if same name)
    for (const [name, handler] of Object.entries(customCommands)) {
      this.commands[name] = handler.bind(this);
    }
  }

  /**
   * Resolves a path (relative or absolute) to an absolute path
   */
  resolvePath(path: string): string {
    // Expand ~ to home directory
    if (path.startsWith('~')) {
      path = this.environment.HOME + path.slice(1);
    }

    if (path.startsWith('/')) {
      return path;
    }
    const parts = this.currentPath.split('/').filter((p) => p);
    const newParts = path.split('/').filter((p) => p);

    for (const part of newParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }
    return '/' + parts.join('/');
  }

  /**
   * Gets a filesystem node at the specified path
   */
  getNode(path: string): FileSystemNode | null {
    const fullPath = this.resolvePath(path);
    const parts = fullPath.split('/').filter((p) => p);
    let current: FileSystemNode = this.fileSystem['/'];

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    return current;
  }

  /**
   * Gets the owner of a file/directory based on path
   */
  getOwner(path: string): FileOwner {
    if (path.startsWith(`/home/${this.currentUser}`) || path === `/home/${this.currentUser}`) {
      return { user: this.currentUser, group: this.currentUser };
    }
    return { user: 'root', group: 'root' };
  }

  /**
   * Checks if current user has write permission to a path
   */
  canWrite(path: string): boolean {
    // Root can write anywhere
    if (this.currentUser === 'root') {
      return true;
    }

    // Regular user can only write in their home directory
    const fullPath = this.resolvePath(path);
    return fullPath.startsWith(`/home/${this.currentUser}`);
  }

  // Command implementations
  cmd_help(): string {
    const commandList = Object.keys(this.commands).sort();
    return `Available commands:\n${commandList.map((cmd) => `  ${cmd}`).join('\n')}\n\nType any command to try it out!`;
  }

  cmd_ls(args: string[]): string {
    // Parse flags and paths
    let showHidden = false;
    let longFormat = false;
    let humanReadable = false;
    const targetPaths: string[] = [];

    for (const arg of args) {
      if (arg.startsWith('-')) {
        // Parse flags
        if (arg.includes('a')) showHidden = true;
        if (arg.includes('l')) longFormat = true;
        if (arg.includes('h')) humanReadable = true;
      } else {
        targetPaths.push(arg);
      }
    }

    // If no paths specified, use current directory
    if (targetPaths.length === 0) {
      targetPaths.push(this.currentPath);
    }

    const results: string[] = [];

    for (const targetPath of targetPaths) {
      const path = targetPath === '.' ? this.currentPath : this.resolvePath(targetPath);
      const node = this.getNode(path);

      if (node === null || node === undefined) {
        results.push(`ls: cannot access '${targetPath}': No such file or directory`);
        continue;
      }

      if (typeof node === 'string') {
        // It's a file, just list the filename
        results.push(targetPath);
        continue;
      }

      let entries = Object.keys(node);

      // Filter hidden files unless -a is specified
      if (!showHidden) {
        entries = entries.filter((name) => !name.startsWith('.'));
      }

      if (entries.length === 0) {
        continue;
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
        const listing = entries
          .map((name) => {
            const isDir = typeof node[name] === 'object';
            const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
            const links = isDir ? '2' : '1';

            // Determine ownership based on file path
            const filePath = path === '/' ? `/${name}` : `${path}/${name}`;
            const owner = this.getOwner(filePath);
            const user = owner.user;
            const group = owner.group;

            let size: string;
            if (isDir) {
              size = '4096';
            } else {
              const bytes = (node[name] as string).length;
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
              minute: '2-digit',
            });

            return `${perms} ${links} ${user.padEnd(8)} ${group.padEnd(8)} ${size.padStart(humanReadable ? 5 : 8)} ${date} ${name}`;
          })
          .join('\n');
        results.push(listing);
      } else {
        // Simple format
        const formatted = entries.map((name) => {
          const isDir = typeof node[name] === 'object';
          return isDir ? `${name}/` : name;
        });

        // If output is being piped, use one per line
        // Otherwise, use columns (space-separated)
        if (this._isPiped) {
          results.push(formatted.join('\n'));
        } else {
          // Multi-column output for terminal display with wider spacing
          results.push(formatted.join('    '));
        }
      }
    }

    return results.join('\n');
  }

  cmd_cd(args: string[]): string {
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

  cmd_pwd(): string {
    return this.currentPath;
  }

  cmd_cat(args: string[]): string {
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

  cmd_echo(args: string[]): string {
    // Join arguments and remove surrounding quotes
    const text = args.join(' ');
    // Remove surrounding single or double quotes
    return text.replace(/^["']|["']$/g, '');
  }

  cmd_clear(): string {
    return '__CLEAR__';
  }

  cmd_whoami(): string {
    return this.environment.USER;
  }

  cmd_date(): string {
    return new Date().toString();
  }

  cmd_uname(args: string[]): string {
    if (args.includes('-a')) {
      return 'UnixShell 1.0.0 UnixShell Terminal x86_64 GNU/JavaScript';
    }
    return 'UnixShell';
  }

  cmd_env(): string {
    return Object.entries(this.environment)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
  }

  cmd_history(): string {
    return this.commandHistory.map((cmd, i) => `${i + 1}  ${cmd}`).join('\n');
  }

  cmd_mkdir(args: string[]): string {
    if (!args[0]) {
      return 'mkdir: missing operand';
    }

    const path = this.resolvePath(args[0]);

    // Check write permission
    if (!this.canWrite(path)) {
      return `mkdir: cannot create directory '${args[0]}': Permission denied`;
    }

    const parts = path.split('/').filter((p) => p);
    const dirName = parts.pop()!;
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

  cmd_touch(args: string[]): string {
    if (!args[0]) {
      return 'touch: missing file operand';
    }

    const path = this.resolvePath(args[0]);

    // Check write permission
    if (!this.canWrite(path)) {
      return `touch: cannot touch '${args[0]}': Permission denied`;
    }

    const parts = path.split('/').filter((p) => p);
    const fileName = parts.pop()!;
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

  cmd_rm(args: string[]): string {
    if (!args[0]) {
      return 'rm: missing operand';
    }

    // Parse flags
    let recursive = false;
    let force = false;
    let verbose = false;
    const targets: string[] = [];

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

    const errors: string[] = [];
    const removed: string[] = [];

    // Process each target
    for (const target of targets) {
      const path = this.resolvePath(target);
      const parts = path.split('/').filter((p) => p);
      const fileName = parts.pop()!;
      const parentPath = '/' + parts.join('/');
      const parent = this.getNode(parentPath);

      // Check write permission
      if (!this.canWrite(parentPath)) {
        errors.push(`rm: cannot remove '${target}': Permission denied`);
        continue;
      }

      if (!parent || typeof parent !== 'object' || !(fileName in parent)) {
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

  cmd_tree(): string {
    const buildTree = (
      node: FileSystemDirectory,
      prefix: string = '',
      isLast: boolean = true
    ): string => {
      let result = '';
      const entries = Object.entries(node);

      entries.forEach(([name, value], index) => {
        const isLastEntry = index === entries.length - 1;
        const connector = isLastEntry ? '└── ' : '├── ';
        const isDir = typeof value === 'object';

        result += prefix + connector + name + (isDir ? '/\n' : '\n');

        if (isDir) {
          const newPrefix = prefix + (isLastEntry ? '    ' : '│   ');
          result += buildTree(value as FileSystemDirectory, newPrefix, isLastEntry);
        }
      });

      return result;
    };

    const node = this.getNode(this.currentPath);
    return this.currentPath + '/\n' + buildTree(node as FileSystemDirectory);
  }

  cmd_ps(args: string[]): string {
    // Basic ps command - shows minimal process list
    // Can be overridden by custom commands for more detailed output

    // Base processes
    const processes: ProcessInfo[] = [
      { pid: 1, user: 'root', tty: '?', time: '0:01', cmd: 'init' },
      { pid: 100, user: this.currentUser, tty: 'pts/0', time: '0:00', cmd: 'bash' },
      { pid: 101, user: this.currentUser, tty: 'pts/0', time: '0:00', cmd: 'ps' },
    ];

    // Simple output format
    let output = '  PID TTY          TIME CMD\n';
    processes.forEach((p) => {
      output += `${String(p.pid).padStart(5)} ${p.tty.padEnd(12)} ${p.time.padStart(8)} ${p.cmd}\n`;
    });

    return output;
  }

  cmd_vi(args: string[]): string {
    return this.openEditor(args[0] || 'untitled');
  }

  cmd_vim(args: string[]): string {
    return this.openEditor(args[0] || 'untitled');
  }

  cmd_su(args: string[]): string {
    const targetUser = args[0] || 'root';

    // Push current user to stack before switching
    this.userStack.push({
      user: this.currentUser,
      home: this.environment.HOME,
      path: this.currentPath,
    });

    this.currentUser = targetUser;
    this.environment.USER = targetUser;
    this.environment.HOME = targetUser === 'root' ? '/root' : `/home/${targetUser}`;

    // Keep current directory (don't change to home)
    this.environment.PWD = this.currentPath;

    return `__USER_SWITCHED__:${targetUser}`;
  }

  cmd_sudo(args: string[]): string {
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

  cmd_exit(): string {
    // Pop the previous user from the stack
    if (this.userStack.length === 0) {
      return 'exit: no other user session to return to';
    }

    const previousUser = this.userStack.pop()!;
    this.currentUser = previousUser.user;
    this.environment.USER = previousUser.user;
    this.environment.HOME = previousUser.home;
    this.currentPath = previousUser.path;
    this.environment.PWD = this.currentPath;

    return `__USER_SWITCHED__:${previousUser.user}`;
  }

  /**
   * Expands wildcards in arguments
   */
  private expandWildcards(args: string[]): string[] {
    const expanded: string[] = [];

    for (const arg of args) {
      // Check if argument contains wildcards
      if (arg.includes('*') || arg.includes('?')) {
        const currentDir = this.getNode(this.currentPath);

        if (currentDir && typeof currentDir === 'object') {
          const pattern = arg.replace(/\*/g, '.*').replace(/\?/g, '.');
          const regex = new RegExp(`^${pattern}$`);
          const matches = Object.keys(currentDir).filter((name) => regex.test(name));

          if (matches.length > 0) {
            expanded.push(...matches);
          } else {
            // No matches, keep the pattern as-is
            expanded.push(arg);
          }
        } else {
          expanded.push(arg);
        }
      } else {
        expanded.push(arg);
      }
    }

    return expanded;
  }

  /**
   * Executes a command line input
   */
  execute(commandLine: string): string {
    if (!commandLine.trim()) {
      return '';
    }

    // Add to history
    this.commandHistory.push(commandLine);

    // Check for pipe to grep
    let grepPattern: string | null = null;
    let grepFlags: GrepFlags = { ignoreCase: false, invert: false };
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
    let redirectMode: 'append' | 'overwrite' | null = null;
    let redirectFile: string | null = null;

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
    let args = parts.slice(1);

    // Expand wildcards in arguments
    args = this.expandWildcards(args);

    // Execute the command
    let output = '';
    if (command in this.commands) {
      try {
        this._isPiped = grepPattern !== null;
        output = this.commands[command](args);
        this._isPiped = false;
      } catch (error) {
        return `Error executing ${command}: ${(error as Error).message}`;
      }
    } else {
      return `${command}: command not found`;
    }

    // Apply grep filter if present
    if (grepPattern !== null && output) {
      const lines = output.split('\n');
      const filtered = lines.filter((line) => {
        let matches: boolean;
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

  /**
   * Writes content to a file
   */
  writeToFile(filePath: string, content: string, mode: 'append' | 'overwrite'): string | null {
    const fullPath = this.resolvePath(filePath);
    const parts = fullPath.split('/').filter((p) => p);
    const fileName = parts.pop()!;
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
      parent[fileName] = (parent[fileName] as string) + content;
    } else {
      parent[fileName] = content;
    }

    return null;
  }

  /**
   * Gets the current working directory
   */
  getCurrentPath(): string {
    return this.currentPath;
  }

  /**
   * Gets the current user
   */
  getCurrentUser(): string {
    return this.currentUser;
  }

  /**
   * Opens the Vi editor
   */
  openEditor(filename: string): string {
    const fullPath = this.resolvePath(filename);
    const node = this.getNode(fullPath);

    let content = '';
    if (node && typeof node === 'string') {
      content = node;
    }

    const saveCallback = (filename: string, content: string): boolean => {
      const result = this.writeToFile(filename, content, 'overwrite');
      return result === null;
    };

    const exitCallback = (): void => {
      if (typeof window !== 'undefined' && (window as any).enableTerminal) {
        (window as any).enableTerminal();
      }
    };

    if (typeof window !== 'undefined' && (window as any).disableTerminal) {
      (window as any).disableTerminal();
    }

    if (typeof window !== 'undefined' && (window as any).ViEditor) {
      new (window as any).ViEditor(filename, content, saveCallback, exitCallback);
    }

    return '__VI_OPENED__';
  }

  /**
   * Gets tab completion suggestions
   */
  getCompletions(partial: string): CompletionResult {
    const parts = partial.trim().split(/\s+/);

    if (parts.length === 1) {
      const prefix = parts[0];
      const commands = Object.keys(this.commands).filter((cmd) => cmd.startsWith(prefix));
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
      .filter((name) => name.startsWith(filePrefix))
      .map((name) => {
        const isDir = typeof node[name] === 'object';
        return isDir ? name + '/' : name;
      });

    return { type: 'path', matches, prefix: pathPrefix, filePrefix };
  }
}

// Default export for convenience
export default UnixShell;
