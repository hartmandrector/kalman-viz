import { FileParser } from './parser';
import { ChartRenderer } from './chart';
import type { LoadedFile } from './types';

class App {
  private loadedFiles: LoadedFile[] = [];
  private chartRenderer: ChartRenderer;

  constructor() {
    this.chartRenderer = new ChartRenderer('chart', 'csvChart');
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    const dropZone = document.getElementById('dropZone')!;
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    const browseBtn = document.getElementById('browseBtn')!;
    const clearBtn = document.getElementById('clearBtn')!;
    const plotBtn = document.getElementById('plotBtn')!;
    const plotCsvBtn = document.getElementById('plotCsvBtn')!;

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
      li.innerHTML = `
        <span>${file.name}</span>
        <span class="file-type ${file.type === 'csv' ? 'csv' : 'json'}">${file.type}</span>
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
  }
}

// Initialize app
new App();
