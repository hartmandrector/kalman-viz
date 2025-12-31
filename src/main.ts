import { FileParser } from './parser';
import { ChartRenderer } from './chart';
import { CorrelationAnalyzer } from './correlation';
import type { LoadedFile, GPSErrorFile, SweepSummary, PredictionModel, SectionSweep } from './types';

class App {
  private loadedFiles: LoadedFile[] = [];
  private chartRenderer: ChartRenderer;
  private correlationMatrix: Map<string, Map<string, any>> | null = null;
  private predictionModels: PredictionModel[] = [];

  constructor() {
    this.chartRenderer = new ChartRenderer('chart', 'csvChart', 'gpsErrorChart', 'correlationChart');
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    const dropZone = document.getElementById('dropZone')!;
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    const browseBtn = document.getElementById('browseBtn')!;
    const clearBtn = document.getElementById('clearBtn')!;
    const plotBtn = document.getElementById('plotBtn')!;
    const plotCsvBtn = document.getElementById('plotCsvBtn')!;
    
    // GPS Error comparison
    const compareGpsBtn = document.getElementById('compareGpsBtn')!;
    const exportGpsErrorsBtn = document.getElementById('exportGpsErrorsBtn')!;
    
    // Correlation analysis
    const plotCorrelationBtn = document.getElementById('plotCorrelationBtn')!;
    const showTopCorrelationsBtn = document.getElementById('showTopCorrelationsBtn')!;
    
    // Prediction
    const predictParametersBtn = document.getElementById('predictParametersBtn')!;
    const exportPredictionBtn = document.getElementById('exportPredictionBtn')!;

    // Browse button
    browseBtn.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        this.handleFiles(Array.from(files));
      }
    });

    // Drag and drop
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      
      const files = e.dataTransfer?.files;
      if (files) {
        this.handleFiles(Array.from(files));
      }
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
      this.loadedFiles = [];
      this.updateUI();
    });

    // Plot button
    plotBtn.addEventListener('click', () => {
      const xAxis = (document.getElementById('xAxis') as HTMLSelectElement).value;
      const yAxisSelect = document.getElementById('yAxis') as HTMLSelectElement;
      const selectedYAxes = Array.from(yAxisSelect.selectedOptions).map(opt => opt.value);
      
      this.chartRenderer.plotParameters(this.loadedFiles, xAxis, selectedYAxes);
    });

    // CSV Plot button
    plotCsvBtn.addEventListener('click', () => {
      const dataTypeFilterSelect = document.getElementById('dataTypeFilter') as HTMLSelectElement;
      const selectedDataTypes = Array.from(dataTypeFilterSelect.selectedOptions).map(opt => opt.value);
      
      const csvColumnsSelect = document.getElementById('csvColumns') as HTMLSelectElement;
      const selectedColumns = Array.from(csvColumnsSelect.selectedOptions).map(opt => opt.value);
      
      this.chartRenderer.plotCSVTimeSeries(this.loadedFiles, selectedColumns, selectedDataTypes);
    });

    // GPS Error Comparison
    compareGpsBtn.addEventListener('click', () => {
      const gpsFileSelect = document.getElementById('gpsErrorFiles') as HTMLSelectElement;
      const selectedIndices = Array.from(gpsFileSelect.selectedOptions).map(opt => parseInt(opt.value));
      const gpsErrorFiles = FileParser.getGPSErrorFiles(this.loadedFiles);
      const selectedFiles = selectedIndices.map(idx => gpsErrorFiles[idx]);
      
      this.chartRenderer.plotGPSErrorComparison(selectedFiles);
    });

    exportGpsErrorsBtn.addEventListener('click', () => {
      const gpsFileSelect = document.getElementById('gpsErrorFiles') as HTMLSelectElement;
      const selectedIndices = Array.from(gpsFileSelect.selectedOptions).map(opt => parseInt(opt.value));
      const gpsErrorFiles = FileParser.getGPSErrorFiles(this.loadedFiles);
      const selectedFiles = selectedIndices.map(idx => gpsErrorFiles[idx]);
      
      this.exportGPSErrorComparison(selectedFiles);
    });

    // Correlation Analysis
    plotCorrelationBtn.addEventListener('click', () => {
      const xDim = (document.getElementById('correlationX') as HTMLSelectElement).value;
      const yParam = (document.getElementById('correlationY') as HTMLSelectElement).value;
      
      if (!xDim || !yParam || !this.correlationMatrix) {
        alert('Please select both GPS error dimension and parameter');
        return;
      }

      const correlation = this.correlationMatrix.get(xDim)?.get(yParam);
      if (correlation) {
        const regression = CorrelationAnalyzer.linearRegression(
          correlation.dataPoints.map((p: any) => p.x),
          correlation.dataPoints.map((p: any) => p.y)
        );
        
        this.chartRenderer.plotCorrelationScatter(correlation, regression);
        
        // Update info display
        document.getElementById('correlationInfo')!.style.display = 'block';
        document.getElementById('correlationCoeff')!.textContent = correlation.coefficient.toFixed(4);
        document.getElementById('rSquared')!.textContent = regression.rSquared.toFixed(4);
        document.getElementById('linearEquation')!.textContent = 
          `y = ${regression.intercept.toFixed(4)} + ${regression.slope.toFixed(4)}x`;
      }
    });

    showTopCorrelationsBtn.addEventListener('click', () => {
      if (!this.correlationMatrix) {
        alert('No correlation data available. Load sweep summary files first.');
        return;
      }

      const topCorrelations = CorrelationAnalyzer.findStrongestCorrelations(this.correlationMatrix, 0.3);
      
      let message = 'Top Correlations (|r| > 0.3):\n\n';
      topCorrelations.slice(0, 20).forEach(corr => {
        message += `${corr.xLabel} → ${corr.yLabel}: r = ${corr.coefficient.toFixed(4)}\n`;
      });
      
      alert(message);
    });

    // Parameter Prediction
    predictParametersBtn.addEventListener('click', () => {
      const gpsFileIdx = parseInt((document.getElementById('predictionGpsFile') as HTMLSelectElement).value);
      
      if (isNaN(gpsFileIdx)) {
        alert('Please select a GPS error file');
        return;
      }

      const gpsErrorFiles = FileParser.getGPSErrorFiles(this.loadedFiles);
      const gpsFile = gpsErrorFiles[gpsFileIdx];

      if (!gpsFile || this.predictionModels.length === 0) {
        alert('No prediction models available. Load sweep summaries first.');
        return;
      }

      const predictions = CorrelationAnalyzer.predictParameters(
        gpsFile.data as GPSErrorFile,
        this.predictionModels
      );

      this.displayPredictions(predictions, this.predictionModels);
    });

    exportPredictionBtn.addEventListener('click', () => {
      this.exportPredictions();
    });
  }

  private async handleFiles(files: File[]) {
    for (const file of files) {
      try {
        const parsed = await FileParser.parseFile(file);
        this.loadedFiles.push(parsed);
      } catch (error) {
        alert(`Error parsing ${file.name}: ${error}`);
      }
    }

    this.updateUI();
  }

  private updateUI() {
    // Update file count
    const fileCount = document.getElementById('fileCount')!;
    fileCount.textContent = this.loadedFiles.length.toString();

    // Update file list
    const fileListItems = document.getElementById('fileListItems')!;
    fileListItems.innerHTML = '';
    
    this.loadedFiles.forEach(file => {
      const li = document.createElement('li');
      const fileTypeClass = file.type === 'csv' ? 'csv' : 'json';
      li.innerHTML = `
        <span>${file.name}</span>
        <span class="file-type ${fileTypeClass}">${file.type}</span>
      `;
      fileListItems.appendChild(li);
    });

    // Update parameter dropdowns - combine JSON parameters and CSV columns
    const parameters = FileParser.extractParameters(this.loadedFiles);
    const csvColumns = FileParser.extractCSVColumns(this.loadedFiles);
    const allFields = [...new Set([...parameters, ...csvColumns])].sort();
    
    const xAxisSelect = document.getElementById('xAxis') as HTMLSelectElement;
    const yAxisSelect = document.getElementById('yAxis') as HTMLSelectElement;
    
    xAxisSelect.innerHTML = '<option value="">-- Select X-Axis --</option>';
    yAxisSelect.innerHTML = '';
    
    allFields.forEach(field => {
      const xOption = document.createElement('option');
      xOption.value = field;
      xOption.textContent = field;
      xAxisSelect.appendChild(xOption);

      const yOption = document.createElement('option');
      yOption.value = field;
      yOption.textContent = field;
      yAxisSelect.appendChild(yOption);
    });

    // Update CSV controls
    const dataTypes = FileParser.extractDataTypes(this.loadedFiles);
    const csvControls = document.getElementById('csvControls')!;
    
    if (allFields.length > 0) {
      csvControls.style.display = 'block';
      
      const csvColumnsSelect = document.getElementById('csvColumns') as HTMLSelectElement;
      csvColumnsSelect.innerHTML = '';
      
      allFields.forEach(column => {
        const option = document.createElement('option');
        option.value = column;
        option.textContent = column;
        csvColumnsSelect.appendChild(option);
      });

      // Populate data type filter
      const dataTypeFilterSelect = document.getElementById('dataTypeFilter') as HTMLSelectElement;
      dataTypeFilterSelect.innerHTML = '';
      
      dataTypes.forEach(dataType => {
        const option = document.createElement('option');
        option.value = dataType;
        option.textContent = dataType;
        option.selected = true; // Select all by default
        dataTypeFilterSelect.appendChild(option);
      });
    } else {
      csvControls.style.display = 'none';
    }

    // Update GPS Error Comparison controls
    const gpsErrorFiles = FileParser.getGPSErrorFiles(this.loadedFiles);
    const gpsErrorControls = document.getElementById('gpsErrorControls')!;
    
    if (gpsErrorFiles.length > 0) {
      gpsErrorControls.style.display = 'block';
      
      const gpsErrorFilesSelect = document.getElementById('gpsErrorFiles') as HTMLSelectElement;
      gpsErrorFilesSelect.innerHTML = '';
      
      gpsErrorFiles.forEach((file, idx) => {
        const option = document.createElement('option');
        option.value = idx.toString();
        option.textContent = file.name;
        option.selected = true;
        gpsErrorFilesSelect.appendChild(option);
      });
    } else {
      gpsErrorControls.style.display = 'none';
    }

    // Update Correlation Analysis controls
    const sweepFiles = FileParser.getSweepSummaries(this.loadedFiles);
    const correlationControls = document.getElementById('correlationControls')!;
    
    if (sweepFiles.length > 0) {
      correlationControls.style.display = 'block';
      
      // Build correlation matrix from all sweeps
      this.correlationMatrix = CorrelationAnalyzer.buildCorrelationMatrix(sweepFiles);
      
      // Build prediction models
      this.predictionModels = CorrelationAnalyzer.getTopPredictionModels(this.correlationMatrix, 15);
      
      // Count total runs/sections
      let totalRuns = 0;
      sweepFiles.forEach(file => {
        if (file.type === 'sweep-summary') {
          const sweep = file.data as SweepSummary;
          totalRuns += sweep.allResults.length;
        } else if (file.type === 'section-sweep') {
          const sectionSweep = file.data as SectionSweep;
          totalRuns += sectionSweep.sections.length;
        }
      });
      
      document.getElementById('sweepCount')!.textContent = sweepFiles.length.toString();
      document.getElementById('runCount')!.textContent = totalRuns.toString();
      
      // Populate GPS error dimension dropdown
      const correlationXSelect = document.getElementById('correlationX') as HTMLSelectElement;
      correlationXSelect.innerHTML = '<option value="">-- Select GPS Error Dimension --</option>';
      
      const errorDimensions = Array.from(this.correlationMatrix.keys()).sort();
      errorDimensions.forEach(dim => {
        const option = document.createElement('option');
        option.value = dim;
        option.textContent = dim;
        correlationXSelect.appendChild(option);
      });
      
      // Populate parameter dropdown
      const correlationYSelect = document.getElementById('correlationY') as HTMLSelectElement;
      correlationYSelect.innerHTML = '<option value="">-- Select Output Parameter --</option>';
      
      const firstDimMap = this.correlationMatrix.values().next().value;
      if (firstDimMap) {
        const parameters = Array.from(firstDimMap.keys()).sort();
        parameters.forEach(param => {
          const option = document.createElement('option');
          option.value = param;
          option.textContent = param;
          correlationYSelect.appendChild(option);
        });
      }
    } else {
      correlationControls.style.display = 'none';
    }

    // Update Prediction controls
    const predictionControls = document.getElementById('predictionControls')!;
    
    if (gpsErrorFiles.length > 0 && this.predictionModels.length > 0) {
      predictionControls.style.display = 'block';
      
      const predictionGpsFileSelect = document.getElementById('predictionGpsFile') as HTMLSelectElement;
      predictionGpsFileSelect.innerHTML = '<option value="">-- Select GPS Error File --</option>';
      
      gpsErrorFiles.forEach((file, idx) => {
        const option = document.createElement('option');
        option.value = idx.toString();
        option.textContent = file.name;
        predictionGpsFileSelect.appendChild(option);
      });
    } else {
      predictionControls.style.display = 'none';
    }
  }

  private exportGPSErrorComparison(files: LoadedFile[]) {
    const lines: string[] = ['File,Component,Value'];
    
    files.forEach(file => {
      const data = file.data as GPSErrorFile;
      const errors = FileParser.extractGPSErrorDimensions(data.gpsError);
      
      Object.entries(errors).forEach(([key, value]) => {
        lines.push(`${file.name},${key},${value}`);
      });
    });
    
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gps-error-comparison.csv';
    a.click();
  }

  private displayPredictions(predictions: Record<string, number>, models: PredictionModel[]) {
    const resultsDiv = document.getElementById('predictionResults')!;
    const tbody = document.querySelector('#predictionTable tbody')!;
    
    tbody.innerHTML = '';
    
    Object.entries(predictions).forEach(([param, value]) => {
      const model = models.find(m => m.outputParameter === param);
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${param}</td>
        <td>${value.toFixed(6)}</td>
        <td>${model?.inputDimension || 'N/A'}</td>
        <td>${model?.rSquared.toFixed(4) || 'N/A'}</td>
      `;
      tbody.appendChild(row);
    });
    
    resultsDiv.style.display = 'block';
  }

  private exportPredictions() {
    const tbody = document.querySelector('#predictionTable tbody')!;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    const json: any = {
      params: {},
      predictions: []
    };
    
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const param = cells[0].textContent || '';
      const value = parseFloat(cells[1].textContent || '0');
      const basedOn = cells[2].textContent || '';
      const rSquared = parseFloat(cells[3].textContent || '0');
      
      json.params[param] = value;
      json.predictions.push({
        parameter: param,
        value,
        basedOn,
        rSquared
      });
    });
    
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'predicted-parameters.json';
    a.click();
  }
}

// Initialize app
new App();
