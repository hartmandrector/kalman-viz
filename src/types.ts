export interface OptimizerMetadata {
  timestamp?: string;
  configName?: string;
  finalParams: Record<string, number>;
  bestScore?: number;
  boundWarnings?: any;
  iteration?: number;
}

export interface ParameterExport {
  label?: string;
  params: Record<string, number>;
  timestamp?: string;
}

export interface CSVData {
  headers: string[];
  rows: Record<string, number>[];
}

export interface LoadedFile {
  name: string;
  type: 'optimizer' | 'params' | 'csv';
  data: OptimizerMetadata | ParameterExport | CSVData;
}

export interface PlotData {
  x: number[];
  y: number[];
  label: string;
}
