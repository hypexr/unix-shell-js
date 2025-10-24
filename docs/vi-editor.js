// Simple Vi/Vim Editor Implementation
// Implements basic vi modal editing functionality
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ViEditor = void 0;
    /**
     * Simple Vi/Vim editor implementation
     */
    class ViEditor {
        /**
         * Creates a new Vi editor instance
         * @param filename - Name of the file being edited
         * @param content - Initial file content
         * @param saveCallback - Function to call when saving
         * @param exitCallback - Function to call when exiting
         */
        constructor(filename, content, saveCallback, exitCallback) {
            this.filename = filename;
            this.lines = content ? content.split('\n') : [''];
            this.saveCallback = saveCallback;
            this.exitCallback = exitCallback;
            this.cursorRow = 0;
            this.cursorCol = 0;
            this.mode = 'normal';
            this.commandBuffer = '';
            this.normalModeBuffer = '';
            this.yankBuffer = '';
            this.message = '';
            this.modified = false;
            this.element = null;
            this.setupUI();
            this.render();
            this.attachEventListeners();
        }
        /**
         * Sets up the editor UI
         */
        setupUI() {
            // Create editor container
            this.element = document.createElement('div');
            this.element.className = 'vi-editor';
            this.element.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            color: #00ff00;
            font-family: 'Courier New', monospace;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            padding: 20px;
            box-sizing: border-box;
        `;
            // Content area
            this.contentArea = document.createElement('pre');
            this.contentArea.style.cssText = `
            flex: 1;
            overflow: auto;
            margin: 0;
            white-space: pre;
            font-size: 14px;
            line-height: 1.4;
        `;
            // Status line
            this.statusLine = document.createElement('div');
            this.statusLine.style.cssText = `
            padding: 5px 0;
            border-top: 1px solid #00ff00;
            margin-top: 10px;
        `;
            this.element.appendChild(this.contentArea);
            this.element.appendChild(this.statusLine);
            document.body.appendChild(this.element);
        }
        /**
         * Renders the editor content and status line
         */
        render() {
            // Render content with cursor
            let output = '';
            for (let i = 0; i < this.lines.length; i++) {
                const line = this.lines[i];
                if (i === this.cursorRow) {
                    // Current line - show cursor
                    for (let j = 0; j <= line.length; j++) {
                        if (j === this.cursorCol) {
                            if (this.mode === 'insert') {
                                output += '|'; // Insert mode cursor
                            }
                            else {
                                output += (j < line.length) ? `[${line[j]}]` : '[█]';
                            }
                        }
                        else if (j < line.length) {
                            output += line[j];
                        }
                    }
                    output += '\n';
                }
                else {
                    output += line + '\n';
                }
            }
            this.contentArea.textContent = output;
            // Update status line
            const modeStr = this.mode.toUpperCase();
            const modifiedStr = this.modified ? '[+]' : '';
            const posStr = `${this.cursorRow + 1},${this.cursorCol + 1}`;
            if (this.mode === 'command') {
                this.statusLine.textContent = `:${this.commandBuffer}`;
            }
            else if (this.message) {
                this.statusLine.textContent = this.message;
            }
            else {
                this.statusLine.textContent = `-- ${modeStr} -- ${modifiedStr} "${this.filename}" ${this.lines.length}L  ${posStr}`;
            }
        }
        /**
         * Attaches keyboard event listeners
         */
        attachEventListeners() {
            this.keyHandler = (e) => this.handleKey(e);
            document.addEventListener('keydown', this.keyHandler);
        }
        /**
         * Main keyboard event handler
         */
        handleKey(e) {
            e.preventDefault();
            this.message = '';
            if (this.mode === 'normal') {
                this.handleNormalMode(e);
            }
            else if (this.mode === 'insert') {
                this.handleInsertMode(e);
            }
            else if (this.mode === 'command') {
                this.handleCommandMode(e);
            }
            this.render();
        }
        /**
         * Handles delete motion commands (d + motion key)
         */
        handleDeleteMotion(key) {
            let deletedContent = '';
            let numLinesDeleted = 0;
            if (key === 'd') {
                // dd - delete entire line
                deletedContent = this.lines[this.cursorRow];
                this.lines.splice(this.cursorRow, 1);
                numLinesDeleted = 1;
                // Ensure there's always at least one line
                if (this.lines.length === 0) {
                    this.lines = [''];
                }
                // Adjust cursor position
                if (this.cursorRow >= this.lines.length) {
                    this.cursorRow = this.lines.length - 1;
                }
                this.cursorCol = 0;
            }
            else if (key === 'j' || key === 'ArrowDown') {
                // dj - delete current line and next line
                if (this.cursorRow < this.lines.length - 1) {
                    deletedContent = this.lines[this.cursorRow] + '\n' + this.lines[this.cursorRow + 1];
                    this.lines.splice(this.cursorRow, 2);
                    numLinesDeleted = 2;
                    if (this.lines.length === 0) {
                        this.lines = [''];
                    }
                    if (this.cursorRow >= this.lines.length) {
                        this.cursorRow = this.lines.length - 1;
                    }
                }
                else {
                    // Just delete current line if at bottom
                    deletedContent = this.lines[this.cursorRow];
                    this.lines.splice(this.cursorRow, 1);
                    numLinesDeleted = 1;
                    if (this.lines.length === 0) {
                        this.lines = [''];
                    }
                    if (this.cursorRow >= this.lines.length) {
                        this.cursorRow = this.lines.length - 1;
                    }
                }
                this.cursorCol = 0;
            }
            else if (key === 'k' || key === 'ArrowUp') {
                // dk - delete current line and previous line
                if (this.cursorRow > 0) {
                    deletedContent = this.lines[this.cursorRow - 1] + '\n' + this.lines[this.cursorRow];
                    this.lines.splice(this.cursorRow - 1, 2);
                    numLinesDeleted = 2;
                    this.cursorRow--;
                    if (this.lines.length === 0) {
                        this.lines = [''];
                        this.cursorRow = 0;
                    }
                    if (this.cursorRow >= this.lines.length) {
                        this.cursorRow = this.lines.length - 1;
                    }
                }
                else {
                    // Just delete current line if at top
                    deletedContent = this.lines[this.cursorRow];
                    this.lines.splice(this.cursorRow, 1);
                    numLinesDeleted = 1;
                    if (this.lines.length === 0) {
                        this.lines = [''];
                    }
                }
                this.cursorCol = 0;
            }
            else if (key === '$') {
                // d$ - delete to end of line
                deletedContent = this.lines[this.cursorRow].slice(this.cursorCol);
                this.lines[this.cursorRow] = this.lines[this.cursorRow].slice(0, this.cursorCol);
            }
            else if (key === '0') {
                // d0 - delete to beginning of line
                deletedContent = this.lines[this.cursorRow].slice(0, this.cursorCol);
                this.lines[this.cursorRow] = this.lines[this.cursorRow].slice(this.cursorCol);
                this.cursorCol = 0;
            }
            else if (key === 'w') {
                // dw - delete word (simplified: delete to next space or end of line)
                const line = this.lines[this.cursorRow];
                const remaining = line.slice(this.cursorCol);
                const match = remaining.match(/^\S+\s*/);
                if (match) {
                    deletedContent = match[0];
                    this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + line.slice(this.cursorCol + match[0].length);
                }
            }
            else if (key === 'l' || key === 'ArrowRight') {
                // dl - delete character at cursor (same as x)
                const line = this.lines[this.cursorRow];
                if (this.cursorCol < line.length) {
                    deletedContent = line[this.cursorCol];
                    this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
                }
            }
            else if (key === 'h' || key === 'ArrowLeft') {
                // dh - delete character before cursor
                const line = this.lines[this.cursorRow];
                if (this.cursorCol > 0) {
                    deletedContent = line[this.cursorCol - 1];
                    this.lines[this.cursorRow] = line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
                    this.cursorCol--;
                }
            }
            else {
                // Unknown motion, cancel delete
                this.normalModeBuffer = '';
                return;
            }
            // Store deleted content in yank buffer and mark as modified
            if (deletedContent) {
                this.yankBuffer = deletedContent;
                this.modified = true;
                if (numLinesDeleted > 0) {
                    this.message = `${numLinesDeleted} line${numLinesDeleted > 1 ? 's' : ''} deleted`;
                }
                else {
                    this.message = 'deleted';
                }
            }
            this.normalModeBuffer = '';
        }
        /**
         * Handles normal mode keyboard events
         */
        handleNormalMode(e) {
            const key = e.key;
            // Check for delete motion commands (d + motion)
            if (this.normalModeBuffer === 'd') {
                this.handleDeleteMotion(key);
                return;
            }
            // Clear the buffer if a different key is pressed
            this.normalModeBuffer = '';
            // Movement
            if (key === 'h' || key === 'ArrowLeft') {
                this.cursorCol = Math.max(0, this.cursorCol - 1);
            }
            else if (key === 'j' || key === 'ArrowDown') {
                this.cursorRow = Math.min(this.lines.length - 1, this.cursorRow + 1);
                this.cursorCol = Math.min(this.cursorCol, this.lines[this.cursorRow].length);
            }
            else if (key === 'k' || key === 'ArrowUp') {
                this.cursorRow = Math.max(0, this.cursorRow - 1);
                this.cursorCol = Math.min(this.cursorCol, this.lines[this.cursorRow].length);
            }
            else if (key === 'l' || key === 'ArrowRight') {
                this.cursorCol = Math.min(this.lines[this.cursorRow].length, this.cursorCol + 1);
            }
            // Line movement
            else if (key === '0') {
                this.cursorCol = 0;
            }
            else if (key === '$') {
                this.cursorCol = this.lines[this.cursorRow].length;
            }
            else if (key === 'g' && e.shiftKey) { // G
                this.cursorRow = this.lines.length - 1;
            }
            // Insert mode
            else if (key === 'i') {
                this.mode = 'insert';
            }
            else if (key === 'a') {
                this.cursorCol = Math.min(this.lines[this.cursorRow].length, this.cursorCol + 1);
                this.mode = 'insert';
            }
            else if (key === 'o') {
                this.lines.splice(this.cursorRow + 1, 0, '');
                this.cursorRow++;
                this.cursorCol = 0;
                this.mode = 'insert';
                this.modified = true;
            }
            else if (key === 'O' && e.shiftKey) {
                this.lines.splice(this.cursorRow, 0, '');
                this.cursorCol = 0;
                this.mode = 'insert';
                this.modified = true;
            }
            // Delete
            else if (key === 'x') {
                if (this.cursorCol < this.lines[this.cursorRow].length) {
                    const line = this.lines[this.cursorRow];
                    this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
                    this.modified = true;
                }
            }
            else if (key === 'd' && e.shiftKey) { // D - delete to end of line
                this.lines[this.cursorRow] = this.lines[this.cursorRow].slice(0, this.cursorCol);
                this.modified = true;
            }
            else if (key === 'd' && !e.shiftKey) { // d - start of multi-key command (dd, dw, etc)
                this.normalModeBuffer = 'd';
            }
            // Yank (copy) line
            else if (key === 'y' && e.shiftKey) { // Y
                this.yankBuffer = this.lines[this.cursorRow];
                this.message = 'yanked line';
            }
            // Paste
            else if (key === 'p') {
                if (this.yankBuffer) {
                    this.lines.splice(this.cursorRow + 1, 0, this.yankBuffer);
                    this.cursorRow++;
                    this.modified = true;
                }
            }
            // Command mode
            else if (key === ':') {
                this.mode = 'command';
                this.commandBuffer = '';
            }
        }
        /**
         * Handles insert mode keyboard events
         */
        handleInsertMode(e) {
            const key = e.key;
            if (key === 'Escape') {
                this.mode = 'normal';
                this.cursorCol = Math.max(0, this.cursorCol - 1);
            }
            else if (key === 'Enter') {
                const line = this.lines[this.cursorRow];
                const before = line.slice(0, this.cursorCol);
                const after = line.slice(this.cursorCol);
                this.lines[this.cursorRow] = before;
                this.lines.splice(this.cursorRow + 1, 0, after);
                this.cursorRow++;
                this.cursorCol = 0;
                this.modified = true;
            }
            else if (key === 'Backspace') {
                if (this.cursorCol > 0) {
                    const line = this.lines[this.cursorRow];
                    this.lines[this.cursorRow] = line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
                    this.cursorCol--;
                    this.modified = true;
                }
                else if (this.cursorRow > 0) {
                    // Join with previous line
                    const currentLine = this.lines[this.cursorRow];
                    this.cursorRow--;
                    this.cursorCol = this.lines[this.cursorRow].length;
                    this.lines[this.cursorRow] += currentLine;
                    this.lines.splice(this.cursorRow + 1, 1);
                    this.modified = true;
                }
            }
            else if (key.length === 1 && !e.ctrlKey && !e.metaKey) {
                const line = this.lines[this.cursorRow];
                this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + key + line.slice(this.cursorCol);
                this.cursorCol++;
                this.modified = true;
            }
        }
        /**
         * Handles command mode keyboard events
         */
        handleCommandMode(e) {
            const key = e.key;
            if (key === 'Escape') {
                this.mode = 'normal';
                this.commandBuffer = '';
            }
            else if (key === 'Enter') {
                this.executeCommand(this.commandBuffer);
                this.commandBuffer = '';
            }
            else if (key === 'Backspace') {
                this.commandBuffer = this.commandBuffer.slice(0, -1);
                if (this.commandBuffer === '') {
                    this.mode = 'normal';
                }
            }
            else if (key.length === 1 && !e.ctrlKey && !e.metaKey) {
                this.commandBuffer += key;
            }
        }
        /**
         * Executes a command mode command
         */
        executeCommand(cmd) {
            if (cmd === 'w') {
                // Write file
                this.save();
                this.message = `"${this.filename}" ${this.lines.length}L written`;
                this.mode = 'normal';
            }
            else if (cmd === 'q') {
                // Quit
                if (this.modified) {
                    this.message = 'No write since last change (add ! to override)';
                    this.mode = 'normal';
                }
                else {
                    this.close();
                }
            }
            else if (cmd === 'q!') {
                // Force quit
                this.close();
            }
            else if (cmd === 'wq' || cmd === 'x') {
                // Write and quit
                this.save();
                this.close();
            }
            else {
                this.message = `Not an editor command: ${cmd}`;
                this.mode = 'normal';
            }
        }
        /**
         * Saves the file
         */
        save() {
            const content = this.lines.join('\n');
            if (this.saveCallback) {
                this.saveCallback(this.filename, content);
            }
            this.modified = false;
        }
        /**
         * Closes the editor
         */
        close() {
            document.removeEventListener('keydown', this.keyHandler);
            if (this.element) {
                document.body.removeChild(this.element);
            }
            if (this.exitCallback) {
                this.exitCallback();
            }
        }
    }
    exports.ViEditor = ViEditor;
    // Make available in browser
    if (typeof window !== 'undefined') {
        window.ViEditor = ViEditor;
    }
});
//# sourceMappingURL=vi-editor.js.map