import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { UnixShell } from '../src/index';
import { createExampleFiles } from '../src/example-files';

// Mock localStorage
class LocalStorageMock {
  private store: { [key: string]: string } = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

(global as any).localStorage = new LocalStorageMock();

describe('UnixShell - Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('should save state to localStorage after command execution', () => {
    const shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    shell.execute('touch newfile.txt');

    // Check that data was saved
    const savedFS = localStorage.getItem('test_filesystem');
    expect(savedFS).not.toBeNull();
    expect(savedFS).toContain('newfile.txt');
  });

  test('should restore state from localStorage on initialization', () => {
    // Create first shell and make changes
    const shell1 = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    shell1.execute('touch persistedfile.txt');
    shell1.execute('cd /');

    // Create second shell - should restore state
    const shell2 = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    expect(shell2.getCurrentPath()).toBe('/');
    const output = shell2.execute('ls /home/testuser');
    expect(output).toContain('persistedfile.txt');
  });

  test('should use custom prefix for localStorage keys', () => {
    const shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'customprefix',
      },
    });

    shell.execute('pwd');

    expect(localStorage.getItem('customprefix_filesystem')).not.toBeNull();
    expect(localStorage.getItem('customprefix_current_user')).not.toBeNull();
    expect(localStorage.getItem('customprefix_current_path')).not.toBeNull();
  });

  test('should use default prefix when not specified', () => {
    const shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
      },
    });

    shell.execute('pwd');

    expect(localStorage.getItem('unixshell_filesystem')).not.toBeNull();
  });

  test('should clear storage with clearStorage method', () => {
    const shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    shell.execute('pwd');
    expect(localStorage.getItem('test_filesystem')).not.toBeNull();

    shell.clearStorage();

    expect(localStorage.getItem('test_filesystem')).toBeNull();
    expect(localStorage.getItem('test_current_user')).toBeNull();
    expect(localStorage.getItem('test_current_path')).toBeNull();
  });

  test('should not persist when persistence is disabled', () => {
    const shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: null,
    });

    shell.execute('touch newfile.txt');

    // No data should be saved
    expect(localStorage.getItem('unixshell_filesystem')).toBeNull();
  });

  test('should restore current user from localStorage', () => {
    const shell1 = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    shell1.execute('su alice');

    const shell2 = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    expect(shell2.getCurrentUser()).toBe('alice');
  });

  test('should handle corrupted localStorage data gracefully', () => {
    localStorage.setItem('test_filesystem', 'invalid json');

    // Should fall back to provided filesystem
    const shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    expect(shell.getCurrentPath()).toBe('/home/testuser');
    expect(shell.getCurrentUser()).toBe('testuser');
  });

  test('should validate that saved path exists in filesystem', () => {
    // Save a path that won't exist in the new filesystem
    localStorage.setItem('test_filesystem', JSON.stringify(createExampleFiles('testuser')));
    localStorage.setItem('test_current_path', '/nonexistent/path');
    localStorage.setItem('test_current_user', 'testuser');

    const shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    // Should fall back to home directory
    expect(shell.getCurrentPath()).toBe('/home/testuser');
  });

  test('should persist file modifications', () => {
    const shell1 = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    shell1.execute('echo "New content" > test.txt');

    const shell2 = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    const output = shell2.execute('cat test.txt');
    expect(output).toBe('New content');
  });

  test('should persist directory structure changes', () => {
    const shell1 = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    shell1.execute('mkdir projects');
    shell1.execute('cd projects');
    shell1.execute('touch app.js');

    const shell2 = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    shell2.execute('cd projects');
    const output = shell2.execute('ls');
    expect(output).toContain('app.js');
  });
});

describe('UnixShell - Persistence Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('should handle empty localStorage', () => {
    const shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    expect(shell.getCurrentUser()).toBe('testuser');
    expect(shell.getCurrentPath()).toBe('/home/testuser');
  });

  test('should manually save to storage', () => {
    const shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: {
        enabled: true,
        prefix: 'test',
      },
    });

    // Clear to ensure manual save works
    localStorage.clear();

    shell.saveToStorage();

    expect(localStorage.getItem('test_filesystem')).not.toBeNull();
  });

  test('should not throw error when clearing storage without persistence', () => {
    const shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
      persistence: null,
    });

    expect(() => shell.clearStorage()).not.toThrow();
  });
});
