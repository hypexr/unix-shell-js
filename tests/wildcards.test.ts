import { describe, expect, test, beforeEach } from '@jest/globals';
import { UnixShell } from '../src/index';
import { createExampleFiles } from '../src/example-files';

describe('UnixShell - Wildcard Expansion', () => {
  let shell: UnixShell;

  beforeEach(() => {
    shell = new UnixShell({
      username: 'testuser',
      fileSystem: createExampleFiles('testuser'),
    });
  });

  test('should expand * to match all files', () => {
    // Create some test files
    shell.execute('touch file1.txt');
    shell.execute('touch file2.txt');
    shell.execute('touch file3.log');

    // Test ls with wildcard
    const output = shell.execute('ls *.txt');
    expect(output).toContain('file1.txt');
    expect(output).toContain('file2.txt');
    expect(output).not.toContain('file3.log');
  });

  test('should remove files with wildcard pattern', () => {
    // Create test files
    shell.execute('touch test1.txt');
    shell.execute('touch test2.txt');
    shell.execute('touch keep.log');

    // Remove with wildcard
    shell.execute('rm *.txt');

    // Verify only .txt files were removed
    const output = shell.execute('ls');
    expect(output).not.toContain('test1.txt');
    expect(output).not.toContain('test2.txt');
    expect(output).toContain('keep.log');
  });

  test('should show verbose output when removing with wildcard', () => {
    shell.execute('touch file1.txt');
    shell.execute('touch file2.txt');

    const output = shell.execute('rm -v *.txt');
    expect(output).toContain('file1.txt');
    expect(output).toContain('file2.txt');
  });

  test('should handle * matching all files in directory', () => {
    shell.execute('touch a.txt');
    shell.execute('touch b.txt');
    shell.execute('touch c.txt');

    const output = shell.execute('rm -rfv *');

    // Should remove all files
    const remaining = shell.execute('ls');
    expect(remaining.trim()).toBe('');
  });

  test('should handle ? wildcard for single character', () => {
    shell.execute('touch file1.txt');
    shell.execute('touch file2.txt');
    shell.execute('touch file10.txt');

    // ? should match single character
    const output = shell.execute('ls file?.txt');
    expect(output).toContain('file1.txt');
    expect(output).toContain('file2.txt');
    expect(output).not.toContain('file10.txt');
  });

  test('should handle no matches for wildcard', () => {
    const output = shell.execute('ls *.xyz');
    // Should return no files or an error
    expect(output).toBeTruthy();
  });

  test('should work with multiple wildcards', () => {
    shell.execute('touch test.txt');
    shell.execute('touch test.log');
    shell.execute('touch data.txt');

    const output = shell.execute('ls *.txt');
    expect(output).toContain('test.txt');
    expect(output).toContain('data.txt');
    expect(output).not.toContain('test.log');
  });
});
