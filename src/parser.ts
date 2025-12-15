import type { OptimizerMetadata, ParameterExport, CSVData, LoadedFile } from './types';

export class FileParser {
  static async parseFile(file: File): Promise<LoadedFile> {
    const fileName = file.name;
    const fileExt = fileName.split('.').pop()?.toLowerCase();

    if (fileExt === 'json') {
      return this.parseJSON(file, fileName);
    } else if (fileExt === 'csv') {
      return this.parseCSV(file, fileName);
    } else {
      throw new Error(`Unsupported file type: ${fileExt}`);
    }
  }

  private static async parseJSON(file: File, fileName: string): Promise<LoadedFile> {
    const text = await file.text();
    const json = JSON.parse(text);

    // Auto-detect JSON type
    if (this.isOptimizerMetadata(json)) {
      return {
        name: fileName,
        type: 'optimizer',
        data: json as OptimizerMetadata
      };
    } else if (this.isParameterExport(json)) {
      return {
        name: fileName,
        type: 'params',
        data: json as ParameterExport
      };
    } else {
      throw new Error(`Unknown JSON format in ${fileName}`);
    }
  }

  private static isOptimizerMetadata(json: any): boolean {
    return json.hasOwnProperty('finalParams') && typeof json.finalParams === 'object';
  }

  private static isParameterExport(json: any): boolean {
    return json.hasOwnProperty('params') && typeof json.params === 'object';
  }

  private static async parseCSV(file: File, fileName: string): Promise<LoadedFile> {
    const text = await file.text();
    const lines = text.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error(`CSV file ${fileName} has insufficient data`);
    }

    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Parse data rows
    const rows: Record<string, number | string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, number | string> = {};
      
      headers.forEach((header, idx) => {
        const value = parseFloat(values[idx]);
        if (!isNaN(value)) {
          row[header] = value;
        } else if (values[idx] !== '') {
          // Store as string if not a number
          row[header] = values[idx];
        }
      });
      
      rows.push(row);
    }

    return {
      name: fileName,
      type: 'csv',
      data: {
        headers,
        rows
      } as CSVData
    };
  }

  static extractParameters(files: LoadedFile[]): string[] {
    const paramSet = new Set<string>();

    files.forEach(file => {
      if (file.type === 'optimizer') {
        const data = file.data as OptimizerMetadata;
        Object.keys(data.finalParams).forEach(key => paramSet.add(key));
        
        // Also add metadata fields as possible axes
        if (data.timestamp) paramSet.add('timestamp');
        if (data.bestScore !== undefined) paramSet.add('bestScore');
        if (data.iteration !== undefined) paramSet.add('iteration');
      } else if (file.type === 'params') {
        const data = file.data as ParameterExport;
        Object.keys(data.params).forEach(key => paramSet.add(key));
        if (data.timestamp) paramSet.add('timestamp');
      }
    });

    return Array.from(paramSet).sort();
  }

  static extractCSVColumns(files: LoadedFile[]): string[] {
    const columnSet = new Set<string>();

    files.forEach(file => {
      if (file.type === 'csv') {
        const data = file.data as CSVData;
        data.headers.forEach(header => columnSet.add(header));
      }
    });

    return Array.from(columnSet).sort();
  }

  static extractDataTypes(files: LoadedFile[]): string[] {
    const dataTypeSet = new Set<string>();

    files.forEach(file => {
      if (file.type === 'csv') {
        const data = file.data as CSVData;
        // Check if data_type column exists
        if (data.headers.includes('data_type')) {
          data.rows.forEach(row => {
            const dataType = row['data_type'];
            if (dataType && typeof dataType === 'string') {
              dataTypeSet.add(dataType);
            }
          });
        }
      }
    });

    return Array.from(dataTypeSet).sort();
  }

  static getValue(file: LoadedFile, key: string): number | string | null {
    if (file.type === 'optimizer') {
      const data = file.data as OptimizerMetadata;
      
      if (key === 'timestamp') return data.timestamp || '';
      if (key === 'bestScore') return data.bestScore ?? null;
      if (key === 'iteration') return data.iteration ?? null;
      
      return data.finalParams[key] ?? null;
    } else if (file.type === 'params') {
      const data = file.data as ParameterExport;
      
      if (key === 'timestamp') return data.timestamp || '';
      
      return data.params[key] ?? null;
    }
    
    return null;
  }
}
