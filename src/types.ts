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
  rows: Record<string, number | string>[];
}

// Error analysis types
export interface Vector3D {
  x: number;
  y: number;
  z: number;
  total: number;
}

export interface Vector2D {
  xs: number;
  ys: number;
  total: number;
}

export interface FuzzinessErrors {
  position: Vector3D;
  velocity: Vector3D;
  acceleration: Vector3D;
  sustainedSpeed?: Vector2D;
}

export interface GPSErrorData {
  position: Vector3D;
  velocity: Vector3D;
  acceleration: Vector3D;
  sustainedSpeed?: Vector2D;
  fuzziness: FuzzinessErrors;
}

export interface GPSErrorFile {
  dataInfo?: {
    pointCount: number;
    groundTruth: string;
    timeRange: {
      start: number;
      end: number;
      duration: number;
    };
  };
  gpsError: GPSErrorData;
  timestamp?: Date; // Extracted from filename
}

export interface KalmanParameters {
  rPosX?: number;
  rPosY?: number;
  rPosZ?: number;
  rPosXZ?: number; // Legacy combined
  rVelocityX?: number;
  rVelocityY?: number;
  rVelocityZ?: number;
  rVelocityXZ?: number; // Legacy combined
  qPosX?: number;
  qPosY?: number;
  qPosZ?: number;
  qPosXZ?: number; // Legacy combined
  qVelocityX?: number;
  qVelocityY?: number;
  qVelocityZ?: number;
  qVelocityXZ?: number; // Legacy combined
  qAccelerationX?: number;
  qAccelerationY?: number;
  qAccelerationZ?: number;
  qAccelerationXZ?: number; // Legacy combined
}

export interface SweepParameter {
  parameter: string;
  interpolation: 'logarithmic' | 'linear';
  min: number;
  max: number;
  steps: number;
}

export interface SweepResult {
  runIndex: number;
  parameters: Record<string, number>;
  finalScore: number;
  converged: boolean;
  timestamp: string;
  finalParams: KalmanParameters;
}

export interface SweepSummary {
  sweepName: string;
  sweepDescription: string;
  combinationMode: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  completedAt: string;
  gpsError: GPSErrorData;
  sweepParameters: SweepParameter[];
  allResults: SweepResult[];
  bestResult: {
    runIndex: number;
    score: number;
    converged: boolean;
    timestamp: string;
    initialParameters: Record<string, number>;
    finalParameters: KalmanParameters;
  };
}

export interface ErrorWeights {
  position: number;
  velocity: number;
  acceleration: number;
  sustainedSpeed: number;
  fuzziness: {
    position: number;
    velocity: number;
    acceleration: number;
    sustainedSpeed: number;
  };
}

export interface ErrorComponents {
  position: Vector3D;
  velocity: Vector3D;
  acceleration: Vector3D;
  sustainedSpeed: Vector2D;
  fuzziness: FuzzinessErrors & { sustainedSpeed: Vector2D };
}

export interface StageResult {
  stage: string;
  score: number;
  iterations: number;
  converged: boolean;
  weights: ErrorWeights;
  errorComponents: ErrorComponents;
  errors: {
    position: number;
    velocity: number;
    acceleration: number;
    sustainedSpeed: number;
    fuzziness: {
      position: number;
      velocity: number;
      acceleration: number;
      sustainedSpeed: number;
    };
  };
  errorDelta?: any;
  scoreDelta?: any;
}

export interface RunMetadata {
  timestamp: string;
  configName: string;
  profile: string;
  rValues: {
    rPosXZ?: number;
    rPosY?: number;
    rVelocityXZ?: number;
    rVelocityY?: number;
  };
  stageCount: number;
  scoreBreakdown: StageResult[];
  allStagesDelta: any;
  bestScore: number;
  boundWarnings: string[];
  finalParams: KalmanParameters;
  weights: ErrorWeights;
}

export interface SectionSweepResult {
  section: {
    name: string;
    startTime: number;
    endTime: number;
    duration: number;
  };
  gpsErrorProfile: GPSErrorData;
  sweepConfig: {
    name: string;
    combinationMode: string;
    parameters: SweepParameter[];
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
  };
  bestResult: {
    runIndex: number;
    score: number;
    converged: boolean;
    sweptParameters: Record<string, number>;
    finalParameters: KalmanParameters;
  };
  allResults: SweepResult[];
  metadata: {
    timestamp: string;
    sweepConfigPath: string;
  };
}

export interface SectionSweep {
  summary: {
    totalSections: number;
    sweepConfigPath: string;
    timestamp: string;
  };
  sections: SectionSweepResult[];
}

export interface LoadedFile {
  name: string;
  type: 'optimizer' | 'params' | 'csv' | 'gps-error' | 'sweep-summary' | 'run-metadata' | 'section-sweep';
  data: OptimizerMetadata | ParameterExport | CSVData | GPSErrorFile | SweepSummary | RunMetadata | SectionSweep;
  timestamp?: Date;
}

export interface PlotData {
  x: number[];
  y: number[];
  label: string;
}

// Correlation analysis types
export interface CorrelationResult {
  xLabel: string;
  yLabel: string;
  coefficient: number;
  dataPoints: Array<{ x: number; y: number; label: string }>;
}

export interface PredictionModel {
  inputDimension: string;
  outputParameter: string;
  modelType: 'linear' | 'polynomial' | 'lookup';
  coefficients?: number[];
  lookupTable?: Array<{ input: number; output: number }>;
  rSquared: number;
}
