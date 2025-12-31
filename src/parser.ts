import type { 
  OptimizerMetadata, 
  ParameterExport, 
  CSVData, 
  LoadedFile, 
  GPSErrorFile, 
  SweepSummary, 
  RunMetadata,
  SectionSweep
} from './types';

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

  private static extractTimestampFromFilename(filename: string): Date | undefined {
    // Match pattern like "2025-12-22T00-27-39" or "2025-12-22T05-20-03"
    const match = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    if (match) {
      // Replace hyphens in time portion with colons
      const isoString = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
      return new Date(isoString);
    }
    return undefined;
  }

  private static async parseJSON(file: File, fileName: string): Promise<LoadedFile> {
    const text = await file.text();
    const json = JSON.parse(text);
    const timestamp = this.extractTimestampFromFilename(fileName);

    // Auto-detect JSON type
    if (this.isSectionSweep(json)) {
      return {
        name: fileName,
        type: 'section-sweep',
        data: json as SectionSweep,
        timestamp
      };
    } else if (this.isGPSError(json)) {
      const data = json as GPSErrorFile;
      if (timestamp) {
        data.timestamp = timestamp;
      }
      return {
        name: fileName,
        type: 'gps-error',
        data,
        timestamp
      };
    } else if (this.isSweepSummary(json)) {
      return {
        name: fileName,
        type: 'sweep-summary',
        data: json as SweepSummary,
        timestamp
      };
    } else if (this.isRunMetadata(json)) {
      return {
        name: fileName,
        type: 'run-metadata',
        data: json as RunMetadata,
        timestamp
      };
    } else if (this.isOptimizerMetadata(json)) {
      return {
        name: fileName,
        type: 'optimizer',
        data: json as OptimizerMetadata,
        timestamp
      };
    } else if (this.isParameterExport(json)) {
      return {
        name: fileName,
        type: 'params',
        data: json as ParameterExport,
        timestamp
      };
    } else {
      throw new Error(`Unknown JSON format in ${fileName}`);
    }
  }

  private static isSectionSweep(json: any): boolean {
    return json.hasOwnProperty('summary') &&
           json.hasOwnProperty('sections') &&
           Array.isArray(json.sections) &&
           json.sections.length > 0 &&
           json.sections[0].hasOwnProperty('gpsErrorProfile') &&
           json.sections[0].hasOwnProperty('bestResult');
  }

  private static isGPSError(json: any): boolean {
    return json.hasOwnProperty('gpsError') && 
           json.gpsError.hasOwnProperty('position') &&
           json.gpsError.hasOwnProperty('velocity') &&
           json.gpsError.hasOwnProperty('acceleration') &&
           !json.hasOwnProperty('allResults'); // Distinguish from sweep summary
  }

  private static isSweepSummary(json: any): boolean {
    return json.hasOwnProperty('sweepName') &&
           json.hasOwnProperty('allResults') &&
           json.hasOwnProperty('bestResult');
  }

  private static isRunMetadata(json: any): boolean {
    return json.hasOwnProperty('scoreBreakdown') &&
           json.hasOwnProperty('stageCount') &&
           json.hasOwnProperty('finalParams');
  }

  private static isOptimizerMetadata(json: any): boolean {
    return json.hasOwnProperty('finalParams') && 
           typeof json.finalParams === 'object' &&
           !json.hasOwnProperty('scoreBreakdown');
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

  // Extract 18-dimensional GPS error vector from GPS error file
  static extractGPSErrorDimensions(gpsError: any): Record<string, number> {
    const dimensions: Record<string, number> = {};
    
    // Position components (3)
    dimensions['position.x'] = gpsError.position?.x ?? 0;
    dimensions['position.y'] = gpsError.position?.y ?? 0;
    dimensions['position.z'] = gpsError.position?.z ?? 0;
    
    // Velocity components (3)
    dimensions['velocity.x'] = gpsError.velocity?.x ?? 0;
    dimensions['velocity.y'] = gpsError.velocity?.y ?? 0;
    dimensions['velocity.z'] = gpsError.velocity?.z ?? 0;
    
    // Acceleration components (3)
    dimensions['acceleration.x'] = gpsError.acceleration?.x ?? 0;
    dimensions['acceleration.y'] = gpsError.acceleration?.y ?? 0;
    dimensions['acceleration.z'] = gpsError.acceleration?.z ?? 0;
    
    // Fuzziness position components (3)
    dimensions['fuzziness.position.x'] = gpsError.fuzziness?.position?.x ?? 0;
    dimensions['fuzziness.position.y'] = gpsError.fuzziness?.position?.y ?? 0;
    dimensions['fuzziness.position.z'] = gpsError.fuzziness?.position?.z ?? 0;
    
    // Fuzziness velocity components (3)
    dimensions['fuzziness.velocity.x'] = gpsError.fuzziness?.velocity?.x ?? 0;
    dimensions['fuzziness.velocity.y'] = gpsError.fuzziness?.velocity?.y ?? 0;
    dimensions['fuzziness.velocity.z'] = gpsError.fuzziness?.velocity?.z ?? 0;
    
    // Fuzziness acceleration components (3)
    dimensions['fuzziness.acceleration.x'] = gpsError.fuzziness?.acceleration?.x ?? 0;
    dimensions['fuzziness.acceleration.y'] = gpsError.fuzziness?.acceleration?.y ?? 0;
    dimensions['fuzziness.acceleration.z'] = gpsError.fuzziness?.acceleration?.z ?? 0;
    
    return dimensions;
  }

  // Extract final parameters, handling both legacy XZ format and separate X/Z
  static extractFinalParameters(params: any): Record<string, number> {
    const extracted: Record<string, number> = {};
    
    // R parameters
    if (params.rPosX !== undefined) extracted['rPosX'] = params.rPosX;
    if (params.rPosY !== undefined) extracted['rPosY'] = params.rPosY;
    if (params.rPosZ !== undefined) extracted['rPosZ'] = params.rPosZ;
    if (params.rPosXZ !== undefined) {
      // Legacy: split XZ into X and Z
      extracted['rPosX'] = params.rPosXZ;
      extracted['rPosZ'] = params.rPosXZ;
    }
    
    if (params.rVelocityX !== undefined) extracted['rVelocityX'] = params.rVelocityX;
    if (params.rVelocityY !== undefined) extracted['rVelocityY'] = params.rVelocityY;
    if (params.rVelocityZ !== undefined) extracted['rVelocityZ'] = params.rVelocityZ;
    if (params.rVelocityXZ !== undefined) {
      extracted['rVelocityX'] = params.rVelocityXZ;
      extracted['rVelocityZ'] = params.rVelocityXZ;
    }
    
    // Q parameters
    if (params.qPosX !== undefined) extracted['qPosX'] = params.qPosX;
    if (params.qPosY !== undefined) extracted['qPosY'] = params.qPosY;
    if (params.qPosZ !== undefined) extracted['qPosZ'] = params.qPosZ;
    if (params.qPosXZ !== undefined) {
      extracted['qPosX'] = params.qPosXZ;
      extracted['qPosZ'] = params.qPosXZ;
    }
    
    if (params.qVelocityX !== undefined) extracted['qVelocityX'] = params.qVelocityX;
    if (params.qVelocityY !== undefined) extracted['qVelocityY'] = params.qVelocityY;
    if (params.qVelocityZ !== undefined) extracted['qVelocityZ'] = params.qVelocityZ;
    if (params.qVelocityXZ !== undefined) {
      extracted['qVelocityX'] = params.qVelocityXZ;
      extracted['qVelocityZ'] = params.qVelocityXZ;
    }
    
    if (params.qAccelerationX !== undefined) extracted['qAccelerationX'] = params.qAccelerationX;
    if (params.qAccelerationY !== undefined) extracted['qAccelerationY'] = params.qAccelerationY;
    if (params.qAccelerationZ !== undefined) extracted['qAccelerationZ'] = params.qAccelerationZ;
    if (params.qAccelerationXZ !== undefined) {
      extracted['qAccelerationX'] = params.qAccelerationXZ;
      extracted['qAccelerationZ'] = params.qAccelerationXZ;
    }
    
    return extracted;
  }

  // Get all GPS error files
  static getGPSErrorFiles(files: LoadedFile[]): LoadedFile[] {
    return files.filter(f => f.type === 'gps-error');
  }

  // Get all sweep summary files (including section-sweep)
  static getSweepSummaries(files: LoadedFile[]): LoadedFile[] {
    return files.filter(f => f.type === 'sweep-summary' || f.type === 'section-sweep');
  }

  // Get all run metadata files
  static getRunMetadata(files: LoadedFile[]): LoadedFile[] {
    return files.filter(f => f.type === 'run-metadata');
  }
}
