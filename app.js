// PixelDraw - Main Application
class PixelDrawApp {
    constructor() {
        // Canvas elements
        this.canvas = document.getElementById('canvas');
        this.canvasWrapper = document.getElementById('canvasWrapper');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        // Canvas settings
        this.canvasSize = 32;
        this.pixelSize = 12;
        this.showGrid = true;

        // Drawing state
        this.currentTool = 'pen';
        this.currentColor = '#ff0000';
        this.isDrawing = false;
        this.lastPixel = null;

        // Canvas data (2D array of colors)
        this.canvasData = [];

        // Undo/Redo stacks
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 20;

        // Recent colors
        this.recentColors = [];
        this.maxRecentColors = 10;

        // Color presets
        this.colorPresets = [
            '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
            '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
            '#FFC0CB', '#A52A2A', '#808080', '#C0C0C0', '#FFD700',
            '#4B0082', '#FF69B4', '#00CED1', '#FF4500', '#2E8B57'
        ];

        this.init();
    }

    init() {
        this.initCanvas();
        this.initTools();
        this.initColorSystem();
        this.initCanvasControls();
        this.initExport();
        this.renderColorPresets();
        this.updateCanvasSize();
    }

    // Initialize canvas and data structure
    initCanvas() {
        // Initialize canvas data with transparent pixels
        this.canvasData = Array(this.canvasSize).fill(null).map(() =>
            Array(this.canvasSize).fill('transparent')
        );

        this.updateCanvasSize();
        this.render();
    }

    // Update canvas dimensions and wrapper
    updateCanvasSize() {
        const totalSize = this.canvasSize * this.pixelSize;

        this.canvas.width = totalSize;
        this.canvas.height = totalSize;

        this.canvasWrapper.style.width = totalSize + 'px';
        this.canvasWrapper.style.height = totalSize + 'px';

        this.render();
    }

    // Render the canvas (pixels + grid)
    render() {
        const totalSize = this.canvasSize * this.pixelSize;

        // Clear canvas
        this.ctx.clearRect(0, 0, totalSize, totalSize);

        // Draw each pixel
        for (let y = 0; y < this.canvasSize; y++) {
            for (let x = 0; x < this.canvasSize; x++) {
                const color = this.canvasData[y][x];
                if (color !== 'transparent') {
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(
                        x * this.pixelSize,
                        y * this.pixelSize,
                        this.pixelSize,
                        this.pixelSize
                    );
                }
            }
        }

        // Draw grid overlay
        if (this.showGrid) {
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            this.ctx.lineWidth = 1;

            // Draw vertical lines
            for (let x = 0; x <= this.canvasSize; x++) {
                const xPos = x * this.pixelSize;
                this.ctx.beginPath();
                this.ctx.moveTo(xPos, 0);
                this.ctx.lineTo(xPos, totalSize);
                this.ctx.stroke();
            }

            // Draw horizontal lines
            for (let y = 0; y <= this.canvasSize; y++) {
                const yPos = y * this.pixelSize;
                this.ctx.beginPath();
                this.ctx.moveTo(0, yPos);
                this.ctx.lineTo(totalSize, yPos);
                this.ctx.stroke();
            }
        }
    }


    // Initialize drawing tools
    initTools() {
        const tools = ['penTool', 'eraserTool', 'eyedropperTool', 'fillTool'];

        tools.forEach(toolId => {
            const btn = document.getElementById(toolId);
            btn.addEventListener('click', () => {
                this.selectTool(toolId.replace('Tool', ''));
            });
        });

        // Canvas mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());

        // Undo/Redo/Clear
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearCanvas());

        // Update cursor based on tool
        this.updateCursor();
    }

    selectTool(tool) {
        this.currentTool = tool;

        // Update button states
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tool + 'Tool').classList.add('active');

        this.updateCursor();
    }

    updateCursor() {
        const cursors = {
            pen: 'cursor-pen',
            eraser: 'cursor-eraser',
            eyedropper: 'cursor-eyedropper',
            fill: 'cursor-fill'
        };

        this.canvas.className = cursors[this.currentTool] || '';
    }

    // Get pixel coordinates from mouse event
    getPixelCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.pixelSize);
        const y = Math.floor((e.clientY - rect.top) / this.pixelSize);

        if (x >= 0 && x < this.canvasSize && y >= 0 && y < this.canvasSize) {
            return { x, y };
        }
        return null;
    }

    handleMouseDown(e) {
        const coords = this.getPixelCoords(e);
        if (!coords) return;

        if (this.currentTool === 'eyedropper') {
            this.pickColor(coords.x, coords.y);
            return;
        }

        if (this.currentTool === 'fill') {
            this.saveState();
            this.floodFill(coords.x, coords.y);
            return;
        }

        this.isDrawing = true;
        this.saveState();
        this.drawPixel(coords.x, coords.y);
        this.lastPixel = coords;
    }

    handleMouseMove(e) {
        if (!this.isDrawing) return;
        if (this.currentTool === 'eyedropper' || this.currentTool === 'fill') return;

        const coords = this.getPixelCoords(e);
        if (!coords) return;

        // Draw line between last pixel and current pixel for smooth drawing
        if (this.lastPixel) {
            this.drawLine(this.lastPixel.x, this.lastPixel.y, coords.x, coords.y);
        }

        this.lastPixel = coords;
    }

    handleMouseUp() {
        this.isDrawing = false;
        this.lastPixel = null;
    }

    // Draw a single pixel
    drawPixel(x, y) {
        if (x < 0 || x >= this.canvasSize || y < 0 || y >= this.canvasSize) return;

        const color = this.currentTool === 'eraser' ? 'transparent' : this.currentColor;

        if (this.canvasData[y][x] === color) return; // No change needed

        this.canvasData[y][x] = color;

        // Re-render to update pixel and grid
        this.render();
    }

    // Bresenham's line algorithm for smooth drawing
    drawLine(x0, y0, x1, y1) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.drawPixel(x0, y0);

            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    // Flood fill algorithm
    floodFill(startX, startY) {
        const targetColor = this.canvasData[startY][startX];
        const fillColor = this.currentColor;

        if (targetColor === fillColor) return;

        const stack = [[startX, startY]];
        const visited = new Set();

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;

            if (visited.has(key)) continue;
            if (x < 0 || x >= this.canvasSize || y < 0 || y >= this.canvasSize) continue;
            if (this.canvasData[y][x] !== targetColor) continue;

            visited.add(key);
            this.canvasData[y][x] = fillColor;

            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        this.render();
    }

    // Color picker tool
    pickColor(x, y) {
        const color = this.canvasData[y][x];
        if (color !== 'transparent') {
            this.setColor(color);
        }
    }

    // Color system initialization
    initColorSystem() {
        // HSL sliders
        const hueSlider = document.getElementById('hueSlider');
        const satSlider = document.getElementById('satSlider');
        const lightSlider = document.getElementById('lightSlider');
        const hexInput = document.getElementById('hexInput');

        const updateColorFromSliders = () => {
            const h = hueSlider.value;
            const s = satSlider.value;
            const l = lightSlider.value;

            const color = this.hslToHex(h, s, l);
            this.setColor(color);

            document.getElementById('hueValue').textContent = h + '°';
            document.getElementById('satValue').textContent = s + '%';
            document.getElementById('lightValue').textContent = l + '%';
        };

        hueSlider.addEventListener('input', updateColorFromSliders);
        satSlider.addEventListener('input', updateColorFromSliders);
        lightSlider.addEventListener('input', updateColorFromSliders);

        hexInput.addEventListener('change', (e) => {
            let hex = e.target.value;
            if (!hex.startsWith('#')) hex = '#' + hex;
            if (/^#[0-9A-F]{6}$/i.test(hex)) {
                this.setColor(hex);
            } else {
                hexInput.value = this.currentColor;
            }
        });

        // Current color display click
        document.getElementById('currentColor').addEventListener('click', () => {
            hexInput.select();
        });
    }

    setColor(color) {
        this.currentColor = color.toLowerCase();
        document.getElementById('currentColor').style.background = this.currentColor;
        document.getElementById('hexInput').value = this.currentColor;

        // Update sliders
        const hsl = this.hexToHSL(this.currentColor);
        document.getElementById('hueSlider').value = hsl.h;
        document.getElementById('satSlider').value = hsl.s;
        document.getElementById('lightSlider').value = hsl.l;
        document.getElementById('hueValue').textContent = hsl.h + '°';
        document.getElementById('satValue').textContent = hsl.s + '%';
        document.getElementById('lightValue').textContent = hsl.l + '%';

        // Add to recent colors
        this.addRecentColor(this.currentColor);
    }

    // HSL to Hex conversion
    hslToHex(h, s, l) {
        h = h / 360;
        s = s / 100;
        l = l / 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        const toHex = x => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    // Hex to HSL conversion
    hexToHSL(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    // Render color presets
    renderColorPresets() {
        const presetGrid = document.getElementById('presetGrid');
        presetGrid.innerHTML = '';

        this.colorPresets.forEach(color => {
            const div = document.createElement('div');
            div.className = 'preset-color';
            div.style.background = color;
            div.addEventListener('click', () => this.setColor(color));
            presetGrid.appendChild(div);
        });
    }

    // Recent colors management
    addRecentColor(color) {
        if (this.recentColors.includes(color)) {
            this.recentColors = this.recentColors.filter(c => c !== color);
        }
        this.recentColors.unshift(color);
        if (this.recentColors.length > this.maxRecentColors) {
            this.recentColors.pop();
        }
        this.renderRecentColors();
    }

    renderRecentColors() {
        const recentGrid = document.getElementById('recentGrid');
        recentGrid.innerHTML = '';

        this.recentColors.forEach(color => {
            const div = document.createElement('div');
            div.className = 'recent-color';
            div.style.background = color;
            div.addEventListener('click', () => this.setColor(color));
            recentGrid.appendChild(div);
        });
    }

    // Canvas controls
    initCanvasControls() {
        const canvasSizeSelect = document.getElementById('canvasSize');
        const pixelSizeSlider = document.getElementById('pixelSize');
        const gridToggle = document.getElementById('gridToggle');

        canvasSizeSelect.addEventListener('change', (e) => {
            const newSize = parseInt(e.target.value);
            if (confirm('Changing canvas size will clear your work. Continue?')) {
                this.canvasSize = newSize;
                this.initCanvas();
            } else {
                e.target.value = this.canvasSize;
            }
        });

        pixelSizeSlider.addEventListener('input', (e) => {
            this.pixelSize = parseInt(e.target.value);
            document.getElementById('pixelSizeValue').textContent = this.pixelSize + 'px';
            this.updateCanvasSize();
        });

        gridToggle.addEventListener('change', (e) => {
            this.showGrid = e.target.checked;
            this.render();
        });
    }

    // Undo/Redo functionality
    saveState() {
        // Deep copy of canvas data
        const state = this.canvasData.map(row => [...row]);
        this.undoStack.push(state);

        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }

        // Clear redo stack when new action is performed
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length === 0) return;

        const currentState = this.canvasData.map(row => [...row]);
        this.redoStack.push(currentState);

        this.canvasData = this.undoStack.pop();
        this.render();
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const currentState = this.canvasData.map(row => [...row]);
        this.undoStack.push(currentState);

        this.canvasData = this.redoStack.pop();
        this.render();
    }

    clearCanvas() {
        if (confirm('Clear the entire canvas?')) {
            this.saveState();
            this.canvasData = Array(this.canvasSize).fill(null).map(() =>
                Array(this.canvasSize).fill('transparent')
            );
            this.render();
        }
    }

    // Export functionality
    initExport() {
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportPNG();
        });
    }

    exportPNG() {
        const scale = parseInt(document.getElementById('exportScale').value);

        // Create temporary canvas at export size
        const exportCanvas = document.createElement('canvas');
        const exportSize = this.canvasSize * scale;
        exportCanvas.width = exportSize;
        exportCanvas.height = exportSize;
        const ctx = exportCanvas.getContext('2d');

        // Draw each pixel at scaled size
        for (let y = 0; y < this.canvasSize; y++) {
            for (let x = 0; x < this.canvasSize; x++) {
                const color = this.canvasData[y][x];
                if (color !== 'transparent') {
                    ctx.fillStyle = color;
                    ctx.fillRect(x * scale, y * scale, scale, scale);
                }
            }
        }

        // Download
        exportCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pixeldraw-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pixelDrawApp = new PixelDrawApp();
});
