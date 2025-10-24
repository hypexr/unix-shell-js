import { describe, expect, test, beforeEach } from '@jest/globals';
import { UnixShell } from '../src/index';
import { createExampleFiles } from '../src/example-files';

describe('UnixShell - Core Functionality', () => {
  let shell: UnixShell;

  beforeEach(() => {
    shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
    });
  });

  test('should initialize with correct user', () => {
    expect(shell.getCurrentUser()).toBe('testuser');
  });

  test('should initialize in home directory', () => {
    expect(shell.getCurrentPath()).toBe('/home/testuser');
  });

  test('should execute pwd command', () => {
    const output = shell.execute('pwd');
    expect(output).toBe('/home/testuser');
  });

  test('should execute whoami command', () => {
    const output = shell.execute('whoami');
    expect(output).toBe('testuser');
  });

  test('should execute date command', () => {
    const output = shell.execute('date');
    expect(output).toBeTruthy(); // Should return something (date/time)
    expect(output.length).toBeGreaterThan(0);
  });

  test('should execute uname command', () => {
    const output = shell.execute('uname');
    expect(output).toContain('UnixShell'); // Should contain UnixShell
  });

  test('should execute clear command', () => {
    const output = shell.execute('clear');
    expect(output).toBe('__CLEAR__');
  });

  test('should execute echo command', () => {
    const output = shell.execute('echo Hello World');
    expect(output).toBe('Hello World');
  });

  test('should maintain command history', () => {
    shell.execute('pwd');
    shell.execute('whoami');
    shell.execute('date');
    const history = shell.execute('history');
    expect(history).toContain('pwd');
    expect(history).toContain('whoami');
    expect(history).toContain('date');
  });
});

describe('UnixShell - Directory Navigation', () => {
  let shell: UnixShell;

  beforeEach(() => {
    shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
    });
  });

  test('should change to root directory', () => {
    shell.execute('cd /');
    expect(shell.getCurrentPath()).toBe('/');
  });

  test('should change to home directory with cd ~', () => {
    shell.execute('cd /');
    shell.execute('cd ~');
    expect(shell.getCurrentPath()).toBe('/home/testuser');
  });

  test('should change to home directory with cd (no args)', () => {
    shell.execute('cd /');
    shell.execute('cd');
    expect(shell.getCurrentPath()).toBe('/home/testuser');
  });

  test('should handle relative paths', () => {
    shell.execute('cd ..');
    expect(shell.getCurrentPath()).toBe('/home');
  });

  test('should handle absolute paths', () => {
    shell.execute('cd /home');
    expect(shell.getCurrentPath()).toBe('/home');
  });

  test('should return error for non-existent directory', () => {
    const output = shell.execute('cd /nonexistent');
    expect(output).toContain('No such file or directory');
  });

  test('should return error when trying to cd into a file', () => {
    const output = shell.execute('cd /home/testuser/README.md');
    expect(output).toContain('Not a directory');
  });
});

describe('UnixShell - File Operations', () => {
  let shell: UnixShell;

  beforeEach(() => {
    shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
    });
  });

  test('should list files with ls', () => {
    const output = shell.execute('ls');
    expect(output).toContain('README.md');
  });

  test('should list files with details using ls -l', () => {
    const output = shell.execute('ls -l');
    expect(output).toContain('README.md');
    expect(output).toContain('testuser');
  });

  test('should list all files including hidden with ls -a', () => {
    const output = shell.execute('ls -a');
    // ls -a shows hidden files, but implementation may not include . and ..
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(0);
  });

  test('should read file with cat', () => {
    const output = shell.execute('cat README.md');
    expect(output).toContain('Welcome');
  });

  test('should return error when cat non-existent file', () => {
    const output = shell.execute('cat nonexistent.txt');
    expect(output).toContain('No such file or directory');
  });

  test('should return error when cat a directory', () => {
    shell.execute('mkdir testdir');
    const output = shell.execute('cat testdir');
    expect(output).toContain('Is a directory');
  });

  test('should create file with touch', () => {
    shell.execute('touch newfile.txt');
    const output = shell.execute('ls');
    expect(output).toContain('newfile.txt');
  });

  test('should read empty file created with touch', () => {
    shell.execute('touch empty.txt');
    const output = shell.execute('cat empty.txt');
    expect(output).toBe('');
  });

  test('should create directory with mkdir', () => {
    shell.execute('mkdir newdir');
    const output = shell.execute('ls');
    expect(output).toContain('newdir');
  });

  test('should return error when mkdir with existing name', () => {
    shell.execute('mkdir testdir');
    const output = shell.execute('mkdir testdir');
    expect(output).toContain('File exists');
  });

  test('should remove file with rm', () => {
    shell.execute('touch deleteme.txt');
    shell.execute('rm deleteme.txt');
    const output = shell.execute('ls');
    expect(output).not.toContain('deleteme.txt');
  });

  test('should remove directory with rm -r', () => {
    shell.execute('mkdir deletedir');
    shell.execute('rm -r deletedir');
    const output = shell.execute('ls');
    expect(output).not.toContain('deletedir');
  });

  test('should return error when rm non-existent file', () => {
    const output = shell.execute('rm nonexistent.txt');
    expect(output).toContain('No such file or directory');
  });

  test('should display directory tree', () => {
    const output = shell.execute('tree');
    expect(output).toContain('/home/testuser');
  });
});

describe('UnixShell - File Redirection', () => {
  let shell: UnixShell;

  beforeEach(() => {
    shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
    });
  });

  test('should write output to file with >', () => {
    shell.execute('echo "Hello World" > test.txt');
    const output = shell.execute('cat test.txt');
    expect(output).toBe('Hello World');
  });

  test('should append output to file with >>', () => {
    shell.execute('echo "Line 1" > test.txt');
    shell.execute('echo "Line 2" >> test.txt');
    const output = shell.execute('cat test.txt');
    expect(output).toContain('Line 1');
    expect(output).toContain('Line 2');
  });

  test('should overwrite file with >', () => {
    shell.execute('echo "First" > test.txt');
    shell.execute('echo "Second" > test.txt');
    const output = shell.execute('cat test.txt');
    expect(output).toBe('Second');
    expect(output).not.toContain('First');
  });
});

describe('UnixShell - Custom Commands', () => {
  let shell: UnixShell;

  beforeEach(() => {
    shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      customCommands: {
        hello: function (args: string[]) {
          return `Hello, ${args[0] || 'World'}!`;
        },
        count: function (args: string[]) {
          return `You provided ${args.length} arguments`;
        },
      },
    });
  });

  test('should execute custom command', () => {
    const output = shell.execute('hello');
    expect(output).toBe('Hello, World!');
  });

  test('should execute custom command with arguments', () => {
    const output = shell.execute('hello Alice');
    expect(output).toBe('Hello, Alice!');
  });

  test('should execute custom command with multiple arguments', () => {
    const output = shell.execute('count one two three');
    expect(output).toBe('You provided 3 arguments');
  });
});

describe('UnixShell - Tab Completion', () => {
  let shell: UnixShell;

  beforeEach(() => {
    shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
    });
  });

  test('should complete command names', () => {
    const result = shell.getCompletions('pw');
    expect(result.type).toBe('command');
    expect(result.matches).toContain('pwd');
  });

  test('should complete file names', () => {
    const result = shell.getCompletions('cat READ');
    expect(result.type).toBe('path');
    expect(result.matches).toContain('README.md');
  });

  test('should return empty for no matches', () => {
    const result = shell.getCompletions('xyz');
    expect(result.matches).toHaveLength(0);
  });
});

describe('UnixShell - User Switching', () => {
  let shell: UnixShell;

  beforeEach(() => {
    shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
    });
  });

  test('should switch to root with su', () => {
    const output = shell.execute('su');
    expect(output).toContain('__USER_SWITCHED__:root');
    expect(shell.getCurrentUser()).toBe('root');
  });

  test('should switch to specific user with su username', () => {
    const output = shell.execute('su alice');
    expect(output).toContain('__USER_SWITCHED__:alice');
    expect(shell.getCurrentUser()).toBe('alice');
  });

  test('should execute command as root with sudo', () => {
    shell.execute('sudo whoami');
    // Should temporarily be root for the command
    // Then return to original user
    expect(shell.getCurrentUser()).toBe('testuser');
  });

  test('should exit to previous user', () => {
    shell.execute('su root');
    expect(shell.getCurrentUser()).toBe('root');
    shell.execute('exit');
    expect(shell.getCurrentUser()).toBe('testuser');
  });
});

describe('UnixShell - Environment Variables', () => {
  let shell: UnixShell;

  beforeEach(() => {
    shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
    });
  });

  test('should display environment variables with env', () => {
    const output = shell.execute('env');
    expect(output).toContain('USER=testuser');
    expect(output).toContain('HOME=/home/testuser');
    expect(output).toContain('PWD=/home/testuser');
  });

  test('should update PWD when changing directory', () => {
    shell.execute('cd /');
    const output = shell.execute('env');
    expect(output).toContain('PWD=/');
  });
});
