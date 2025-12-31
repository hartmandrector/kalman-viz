import type { LoadedFile, CorrelationResult, PredictionModel, SweepSummary, GPSErrorFile, SectionSweep } from './types';
import { FileParser } from './parser';

export class CorrelationAnalyzer {
  // Calculate Pearson correlation coefficient
  static calculateCorrelation(xValues: number[], yValues: number[]): number {
    if (xValues.length !== yValues.length || xValues.length === 0) {
      return 0;
    }

    const n = xValues.length;
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);
    const sumY2 = yValues.reduce((sum, y) => sum + y * y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  // Build correlation matrix for all sweep results
  static buildCorrelationMatrix(sweepFiles: LoadedFile[]): Map<string, Map<string, CorrelationResult>> {
    const matrix = new Map<string, Map<string, CorrelationResult>>();

    // Aggregate all runs from all sweeps
    const allRuns: Array<{
      gpsErrors: Record<string, number>;
      finalParams: Record<string, number>;
      label: string;
    }> = [];

    sweepFiles.forEach(file => {
      if (file.type === 'sweep-summary') {
        const sweep = file.data as SweepSummary;
        
        // Extract GPS errors from sweep
        const gpsErrors = FileParser.extractGPSErrorDimensions(sweep.gpsError);

        // Each run in the sweep
        sweep.allResults.forEach(result => {
          const finalParams = FileParser.extractFinalParameters(result.finalParams);
          allRuns.push({
            gpsErrors,
            finalParams,
            label: `${file.name} - Run ${result.runIndex}`
          });
        });
      } else if (file.type === 'section-sweep') {
        const sectionSweep = file.data as SectionSweep;
        
        // Each section has its own GPS error profile and best result
        sectionSweep.sections.forEach(section => {
          const gpsErrors = FileParser.extractGPSErrorDimensions(section.gpsErrorProfile);
          const finalParams = FileParser.extractFinalParameters(section.bestResult.finalParameters);
          
          allRuns.push({
            gpsErrors,
            finalParams,
            label: `${file.name} - ${section.section.name}`
          });
        });
      }
    });

    if (allRuns.length === 0) {
      return matrix;
    }

    // Get all GPS error dimension names
    const gpsErrorDimensions = Object.keys(allRuns[0].gpsErrors);
    
    // Get all parameter names
    const parameterNames = Object.keys(allRuns[0].finalParams);

    // Calculate correlations between each GPS error dimension and each parameter
    gpsErrorDimensions.forEach(errorDim => {
      const errorMap = new Map<string, CorrelationResult>();

      parameterNames.forEach(param => {
        const xValues: number[] = [];
        const yValues: number[] = [];
        const dataPoints: Array<{ x: number; y: number; label: string }> = [];

        allRuns.forEach(run => {
          const xVal = run.gpsErrors[errorDim];
          const yVal = run.finalParams[param];
          
          if (xVal !== undefined && yVal !== undefined && 
              !isNaN(xVal) && !isNaN(yVal) && isFinite(xVal) && isFinite(yVal)) {
            xValues.push(xVal);
            yValues.push(yVal);
            dataPoints.push({ x: xVal, y: yVal, label: run.label });
          }
        });

        const coefficient = this.calculateCorrelation(xValues, yValues);

        errorMap.set(param, {
          xLabel: errorDim,
          yLabel: param,
          coefficient,
          dataPoints
        });
      });

      matrix.set(errorDim, errorMap);
    });

    return matrix;
  }

  // Find strongest correlations
  static findStrongestCorrelations(
    matrix: Map<string, Map<string, CorrelationResult>>,
    threshold: number = 0.5
  ): CorrelationResult[] {
    const strong: CorrelationResult[] = [];

    matrix.forEach((paramMap) => {
      paramMap.forEach((result) => {
        if (Math.abs(result.coefficient) >= threshold) {
          strong.push(result);
        }
      });
    });

    // Sort by absolute correlation strength
    return strong.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
  }

  // Perform linear regression
  static linearRegression(xValues: number[], yValues: number[]): { slope: number; intercept: number; rSquared: number } {
    if (xValues.length !== yValues.length || xValues.length < 2) {
      return { slope: 0, intercept: 0, rSquared: 0 };
    }

    const n = xValues.length;
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = sumY / n;
    const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = yValues.reduce((sum, y, i) => {
      const predicted = slope * xValues[i] + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = 1 - (ssResidual / ssTotal);

    return { slope, intercept, rSquared };
  }

  // Build prediction model for a correlation
  static buildPredictionModel(correlation: CorrelationResult): PredictionModel {
    const xValues = correlation.dataPoints.map(p => p.x);
    const yValues = correlation.dataPoints.map(p => p.y);

    const regression = this.linearRegression(xValues, yValues);

    return {
      inputDimension: correlation.xLabel,
      outputParameter: correlation.yLabel,
      modelType: 'linear',
      coefficients: [regression.intercept, regression.slope],
      rSquared: regression.rSquared
    };
  }

  // Predict parameters from GPS error
  static predictParameters(
    gpsError: GPSErrorFile,
    models: PredictionModel[]
  ): Record<string, number> {
    const predictions: Record<string, number> = {};
    const gpsErrorDims = FileParser.extractGPSErrorDimensions(gpsError.gpsError);

    models.forEach(model => {
      const inputValue = gpsErrorDims[model.inputDimension];
      
      if (inputValue !== undefined && model.coefficients && model.coefficients.length >= 2) {
        // Linear model: y = a + bx
        const predicted = model.coefficients[0] + model.coefficients[1] * inputValue;
        
        // Only use predictions from strong models
        if (model.rSquared > 0.3) {
          predictions[model.outputParameter] = predicted;
        }
      }
    });

    return predictions;
  }

  // Get top N prediction models
  static getTopPredictionModels(
    matrix: Map<string, Map<string, CorrelationResult>>,
    topN: number = 10
  ): PredictionModel[] {
    const allCorrelations: CorrelationResult[] = [];

    matrix.forEach((paramMap) => {
      paramMap.forEach((result) => {
        allCorrelations.push(result);
      });
    });

    // Sort by absolute correlation and take top N
    const topCorrelations = allCorrelations
      .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
      .slice(0, topN);

    // Build models for top correlations
    return topCorrelations.map(corr => this.buildPredictionModel(corr));
  }

  // Export correlation summary as text
  static exportCorrelationSummary(matrix: Map<string, Map<string, CorrelationResult>>): string {
    const lines: string[] = ['GPS Error Dimension,Parameter,Correlation Coefficient'];

    matrix.forEach((paramMap, errorDim) => {
      paramMap.forEach((result, param) => {
        lines.push(`${errorDim},${param},${result.coefficient.toFixed(4)}`);
      });
    });

    return lines.join('\n');
  }
}
