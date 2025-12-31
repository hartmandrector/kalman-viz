import { Chart, ChartConfiguration, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import type { LoadedFile, CSVData, GPSErrorFile, CorrelationResult } from './types';
import { FileParser } from './parser';

Chart.register(...registerables, zoomPlugin);

export class ChartRenderer {
  private chart: Chart | null = null;
  private csvChart: Chart | null = null;
  private gpsErrorChart: Chart | null = null;
  private correlationChart: Chart | null = null;

  constructor(
    private canvasId: string,
    private csvCanvasId: string,
    private gpsErrorCanvasId: string,
    private correlationCanvasId: string
  ) {}

  plotParameters(files: LoadedFile[], xAxis: string, yAxes: string[]) {
    if (!xAxis || yAxes.length === 0) {
      console.warn('X-axis or Y-axis not selected');
      return;
    }

    // Filter to only JSON files
    const jsonFiles = files.filter(f => f.type === 'optimizer' || f.type === 'params');

    if (jsonFiles.length === 0) {
      console.warn('No JSON files loaded');
      return;
    }

    // Prepare datasets for each Y-axis
    const datasets = yAxes.map((yAxis, idx) => {
      const dataPoints: { x: number, y: number, label: string }[] = [];

      jsonFiles.forEach(file => {
        const xValue = FileParser.getValue(file, xAxis);
        const yValue = FileParser.getValue(file, yAxis);

        if (xValue !== null && yValue !== null) {
          const xNum = typeof xValue === 'string' ? this.parseTimestamp(xValue) : xValue;
          const yNum = typeof yValue === 'number' ? yValue : parseFloat(yValue as string);

          if (!isNaN(xNum) && !isNaN(yNum)) {
            dataPoints.push({
              x: xNum,
              y: yNum,
              label: file.name
            });
          }
        }
      });

      // Generate color
      const color = this.getColor(idx);

      return {
        label: yAxis,
        data: dataPoints,
        backgroundColor: color,
        borderColor: color,
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      };
    });

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    // Create new chart
    const canvas = document.getElementById(this.canvasId) as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const config: ChartConfiguration = {
      type: 'scatter',
      data: {
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: true,
            text: `${yAxes.join(', ')} vs ${xAxis}`,
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const point = context.raw;
                return `${context.dataset.label}: (${point.x.toFixed(4)}, ${point.y.toFixed(4)}) - ${point.label}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: xAxis
            },
            type: 'linear'
          },
          y: {
            title: {
              display: true,
              text: yAxes.join(', ')
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  plotCSVTimeSeries(files: LoadedFile[], columns: string[], dataTypeFilter: string[] = []) {
    if (columns.length === 0) {
      console.warn('No columns selected');
      return;
    }

    const csvFiles = files.filter(f => f.type === 'csv');

    if (csvFiles.length === 0) {
      console.warn('No CSV files loaded');
      return;
    }

    // Use first CSV file for now (could extend to handle multiple)
    const csvData = csvFiles[0].data as CSVData;

    // Find time column (first column or column named 'timestamp', 'time', etc.)
    const timeColumn = csvData.headers[0];

    // Check if we need to filter by data_type
    const hasDataTypeColumn = csvData.headers.includes('data_type');
    const shouldFilter = hasDataTypeColumn && dataTypeFilter.length > 0;

    // Get list of data types to plot (either filtered or all)
    let dataTypesToPlot: string[] = [];
    if (hasDataTypeColumn) {
      const allDataTypes = new Set<string>();
      csvData.rows.forEach(row => {
        const dataType = row['data_type'];
        if (dataType && typeof dataType === 'string') {
          allDataTypes.add(dataType);
        }
      });
      dataTypesToPlot = shouldFilter 
        ? dataTypeFilter 
        : Array.from(allDataTypes).sort();
    }

    // Create datasets for each (data_type, column) combination
    const datasets: any[] = [];
    let colorIdx = 0;

    if (hasDataTypeColumn && dataTypesToPlot.length > 0) {
      // Plot each data type and column combination separately
      dataTypesToPlot.forEach(dataType => {
        columns.forEach(column => {
          const dataPoints: { x: number, y: number }[] = [];

          csvData.rows.forEach(row => {
            const rowDataType = row['data_type'];
            if (rowDataType !== dataType) {
              return; // Skip rows that don't match this data type
            }

            const xValue = row[timeColumn];
            const yValue = row[column];

            if (xValue !== undefined && yValue !== undefined && typeof xValue === 'number' && typeof yValue === 'number') {
              dataPoints.push({ x: xValue, y: yValue });
            }
          });

          if (dataPoints.length > 0) {
            const color = this.getColor(colorIdx++);

            datasets.push({
              label: `${dataType} - ${column}`,
              data: dataPoints,
              borderColor: color,
              backgroundColor: color + '33', // Add transparency
              borderWidth: 2,
              pointRadius: 2,
              tension: 0.1
            });
          }
        });
      });
    } else {
      // No data type column, plot by column only (original behavior)
      columns.forEach(column => {
        const dataPoints: { x: number, y: number }[] = [];

        csvData.rows.forEach(row => {
          const xValue = row[timeColumn];
          const yValue = row[column];

          if (xValue !== undefined && yValue !== undefined && typeof xValue === 'number' && typeof yValue === 'number') {
            dataPoints.push({ x: xValue, y: yValue });
          }
        });

        const color = this.getColor(colorIdx++);

        datasets.push({
          label: column,
          data: dataPoints,
          borderColor: color,
          backgroundColor: color + '33', // Add transparency
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.1
        });
      });
    }

    // Destroy existing chart
    if (this.csvChart) {
      this.csvChart.destroy();
    }

    // Create new chart
    const canvas = document.getElementById(this.csvCanvasId) as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: true,
            text: `CSV Time Series: ${columns.join(', ')}`,
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x'
            },
            zoom: {
              wheel: {
                enabled: true
              },
              pinch: {
                enabled: true
              },
              mode: 'x'
            },
            limits: {
              x: { min: 'original', max: 'original' }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: timeColumn
            },
            type: 'linear'
          },
          y: {
            title: {
              display: true,
              text: 'Value'
            },
            type: 'linear'
          }
        }
      }
    };

    this.csvChart = new Chart(ctx, config);
  }

  private parseTimestamp(timestamp: string): number {
    // Try to parse ISO timestamp
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
    
    // Fallback: hash the string to a number
    let hash = 0;
    for (let i = 0; i < timestamp.length; i++) {
      hash = ((hash << 5) - hash) + timestamp.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private getColor(index: number): string {
    const colors = [
      '#667eea',
      '#764ba2',
      '#f093fb',
      '#4facfe',
      '#00f2fe',
      '#43e97b',
      '#38f9d7',
      '#fa709a',
      '#fee140',
      '#30cfd0',
      '#a8edea',
      '#ff6b6b',
      '#4ecdc4',
      '#45b7d1',
      '#96ceb4'
    ];
    return colors[index % colors.length];
  }

  plotGPSErrorComparison(gpsErrorFiles: LoadedFile[]) {
    if (gpsErrorFiles.length === 0) {
      console.warn('No GPS error files selected');
      return;
    }

    // Extract error components for each file
    const categories = [
      'position.x', 'position.y', 'position.z',
      'velocity.x', 'velocity.y', 'velocity.z',
      'acceleration.x', 'acceleration.y', 'acceleration.z',
      'fuzz.pos.x', 'fuzz.pos.y', 'fuzz.pos.z',
      'fuzz.vel.x', 'fuzz.vel.y', 'fuzz.vel.z',
      'fuzz.acc.x', 'fuzz.acc.y', 'fuzz.acc.z'
    ];

    const datasets = gpsErrorFiles.map((file, idx) => {
      const data = file.data as GPSErrorFile;
      const errors = FileParser.extractGPSErrorDimensions(data.gpsError);
      
      // Map to category order
      const values = [
        errors['position.x'],
        errors['position.y'],
        errors['position.z'],
        errors['velocity.x'],
        errors['velocity.y'],
        errors['velocity.z'],
        errors['acceleration.x'],
        errors['acceleration.y'],
        errors['acceleration.z'],
        errors['fuzziness.position.x'],
        errors['fuzziness.position.y'],
        errors['fuzziness.position.z'],
        errors['fuzziness.velocity.x'],
        errors['fuzziness.velocity.y'],
        errors['fuzziness.velocity.z'],
        errors['fuzziness.acceleration.x'],
        errors['fuzziness.acceleration.y'],
        errors['fuzziness.acceleration.z']
      ];

      const color = this.getColor(idx);

      return {
        label: file.name,
        data: values,
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1
      };
    });

    // Destroy existing chart
    if (this.gpsErrorChart) {
      this.gpsErrorChart.destroy();
    }

    // Create new chart
    const canvas = document.getElementById(this.gpsErrorCanvasId) as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: categories,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: true,
            text: 'GPS Error Comparison - All Dimensions',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Error Dimension'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Error Magnitude'
            },
            type: 'logarithmic'
          }
        }
      }
    };

    this.gpsErrorChart = new Chart(ctx, config);
  }

  plotCorrelationScatter(correlation: CorrelationResult, regressionLine?: { slope: number; intercept: number }) {
    if (correlation.dataPoints.length === 0) {
      console.warn('No data points for correlation');
      return;
    }

    const datasets: any[] = [
      {
        label: `${correlation.yLabel} vs ${correlation.xLabel}`,
        data: correlation.dataPoints.map(p => ({ x: p.x, y: p.y })),
        backgroundColor: this.getColor(0),
        borderColor: this.getColor(0),
        pointRadius: 6,
        pointHoverRadius: 8
      }
    ];

    // Add regression line if provided
    if (regressionLine) {
      const xValues = correlation.dataPoints.map(p => p.x).sort((a, b) => a - b);
      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      
      const regressionPoints = [
        { x: minX, y: regressionLine.slope * minX + regressionLine.intercept },
        { x: maxX, y: regressionLine.slope * maxX + regressionLine.intercept }
      ];

      datasets.push({
        label: 'Linear Fit',
        data: regressionPoints,
        type: 'line',
        borderColor: '#ff6b6b',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      });
    }

    // Destroy existing chart
    if (this.correlationChart) {
      this.correlationChart.destroy();
    }

    // Create new chart
    const canvas = document.getElementById(this.correlationCanvasId) as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const config: ChartConfiguration = {
      type: 'scatter',
      data: {
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: true,
            text: `Correlation: ${correlation.xLabel} → ${correlation.yLabel}`,
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const point = context.raw;
                const dataPoint = correlation.dataPoints[context.dataIndex];
                return `(${point.x.toFixed(4)}, ${point.y.toFixed(4)}) - ${dataPoint?.label || ''}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: correlation.xLabel
            },
            type: 'linear'
          },
          y: {
            title: {
              display: true,
              text: correlation.yLabel
            },
            type: 'linear'
          }
        }
      }
    };

    this.correlationChart = new Chart(ctx, config);
  }
}
