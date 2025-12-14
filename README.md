# Kalman Filter Optimization Results Viewer

A lightweight web application for visualizing Kalman filter optimization results across multiple runs.

## Features

- **Multi-format file support**: Load optimizer metadata JSON, parameter export JSON, and CSV files
- **Drag & drop interface**: Easy file loading with drag-and-drop or file picker
- **Flexible visualization**: Plot any parameter against any other parameter
- **Multi-series plotting**: Compare multiple parameters on the same chart
- **CSV time series**: Visualize error data over time from CSV files
- **Dynamic column detection**: Automatically detects available parameters and CSV columns
- **Interactive charts**: Hover tooltips, zooming, and responsive design

## Supported File Formats

### 1. Optimizer Metadata JSON
```json
{
  "timestamp": "2025-12-13T02-05-25",
  "configName": "VR Accuracy - Final",
  "finalParams": {
    "rPosXZ": 0.053475,
    "rPosY": 0.00528,
    "qVelocityY": 0.01
  },
  "bestScore": 1.659,
  "iteration": 42
}
```

### 2. Parameter Export JSON
```json
{
  "label": "Experiment 1",
  "params": {
    "rPosXZ": 0.053475,
    "qVelocityY": 0.01
  },
  "timestamp": "2025-12-13T02-05-25"
}
```

### 3. CSV Files
Any CSV with headers. First column is assumed to be time/x-axis:
```csv
timestamp,posErrorXZ,posErrorY,velErrorXZ,velErrorY
0.0,0.123,0.045,0.012,0.008
0.1,0.115,0.042,0.011,0.007
...
```

## Setup Instructions

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Navigate to the project directory:
```bash
cd c:\dev\kalman-viz
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to the URL shown (typically `http://localhost:5173`)

### Building for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` directory.

To preview the production build:
```bash
npm run preview
```

## Usage Guide

### Loading Files

1. **Drag & Drop**: Drag JSON or CSV files directly onto the drop zone
2. **File Picker**: Click "Browse Files" to select files from your system
3. **Multiple Files**: You can load multiple files at once

### Plotting Parameters

1. Load one or more JSON files (optimizer metadata or parameter exports)
2. Select an X-axis parameter from the dropdown (e.g., `timestamp`, `bestScore`, `rPosXZ`)
3. Select one or more Y-axis parameters (hold Ctrl/Cmd for multi-select)
4. Click "Update Plot" to generate the chart

### CSV Time Series

1. Load a CSV file with error data
2. The CSV controls will appear automatically
3. Select columns to plot (hold Ctrl/Cmd for multi-select)
4. Click "Plot CSV Time Series" to visualize

### Tips

- **Compare runs**: Load multiple optimizer metadata files to see parameter evolution across runs
- **Multi-parameter view**: Select multiple Y-axes to overlay different parameters
- **Hover for details**: Hover over points to see exact values and source file names
- **Custom axes**: Plot any parameter against any other (e.g., `rPosXZ` vs `bestScore`)

## Technology Stack

- **Vite**: Fast build tool and dev server
- **TypeScript**: Type-safe code
- **Chart.js**: Interactive charting library
- **Vanilla JS**: No heavy framework overhead
- **CSS3**: Modern, responsive styling

## Project Structure

```
kalman-viz/
├── index.html          # Main HTML file
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── README.md           # This file
└── src/
    ├── main.ts         # Application entry point
    ├── parser.ts       # File parsing logic
    ├── chart.ts        # Chart rendering
    ├── types.ts        # TypeScript type definitions
    └── style.css       # Styling
```

## Future Enhancements

- Export charts as images
- Save/load plot configurations
- Statistical analysis (mean, std dev, regression)
- Filter files by metadata
- Compare specific runs side-by-side
- Support for more file formats

## License

MIT
