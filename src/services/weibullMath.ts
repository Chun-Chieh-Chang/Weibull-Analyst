import { WeibullDataPoint, WeibullResult, RankMethod } from '../types';

// Lanczos approximation for Gamma function
const gamma = (z: number): number => {
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];

  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  
  z -= 1;
  let x = p[0];
  for (let i = 1; i < p.length; i++) {
    x += p[i] / (z + i);
  }
  
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
};

export const parseInputData = (input: string): { time: number; status: 'F' | 'S' }[] => {
  return input
    .split('\n')
    .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        
        // Match number followed optionally by 'S' or 'F' (case insensitive)
        // format: "100", "100 S", "100 F", "100 s"
        const match = trimmed.match(/^([\d.]+)(?:\s+([a-zA-Z]+))?/);
        if (match) {
            const time = parseFloat(match[1]);
            const statusChar = match[2]?.toUpperCase();
            // Default to 'F' unless explicitly 'S' (Suspension)
            const status = (statusChar && (statusChar.startsWith('S'))) ? 'S' : 'F';
            
            if (!isNaN(time) && time > 0) {
                return { time, status };
            }
        }
        return null;
    })
    .filter((item): item is { time: number; status: 'F' | 'S' } => item !== null)
    .sort((a, b) => {
        if (a.time !== b.time) {
            return a.time - b.time;
        }
        // Deterministic sort for same time: Failures first
        if (a.status === 'F' && b.status === 'S') return -1;
        if (a.status === 'S' && b.status === 'F') return 1;
        return 0;
    });
};

export const calculateWeibull = (
    data: { time: number; status: 'F' | 'S' }[], 
    method: RankMethod = RankMethod.MEDIAN
): WeibullResult | null => {
  const n = data.length;
  if (n < 2) return null;

  // Rank Adjustment Algorithm for Suspended Data
  let previousOrderNumber = 0;
  
  const dataPoints: WeibullDataPoint[] = data.map((item, i) => {
    const reverseRank = n - i; // (N - i + 1) if i was 1-based, but here i is 0-based so N-(i+1)+1 = N-i
    // Correct formula denominator: N - (i+1) + 1 = N - i.
    
    let orderNumber = previousOrderNumber;
    let rank = 0;
    
    if (item.status === 'F') {
        // Calculate new order number increment
        // NewOrder = PreviousOrder + (N + 1 - PreviousOrder) / (N - i + 1)
        const increment = (n + 1 - previousOrderNumber) / (reverseRank + 1); // reverseRank + 1 because formula uses 1-based index logic
        orderNumber = previousOrderNumber + increment;
        previousOrderNumber = orderNumber; // Update for next iteration

        // Calculate Median Rank using Benard's approximation with the adjusted order number
        if (method === RankMethod.MEDIAN) {
            rank = (orderNumber - 0.3) / (n + 0.4);
        } else {
            rank = orderNumber / (n + 1);
        }
    } else {
        // For suspensions, we don't calculate a rank for plotting, 
        // and we don't increment the Order Number (it stays "stuck" until next failure jumps it forward)
    }

    // Coordinates
    let x = Math.log(item.time);
    let y = 0;
    
    if (item.status === 'F' && rank > 0 && rank < 1) {
        y = Math.log(-Math.log(1 - rank));
    }

    return { 
        id: i, 
        time: item.time, 
        rank: rank, 
        x, 
        y, 
        status: item.status 
    };
  });

  // Perform Regression ONLY on Failures
  const failurePoints = dataPoints.filter(p => p.status === 'F');
  const nFailures = failurePoints.length;

  if (nFailures < 2) {
      // Not enough failures to calculate line
      return {
          beta: 0,
          eta: 0,
          mttf: 0,
          rSquared: 0,
          dataPoints,
          linePoints: []
      };
  }

  const sumX = failurePoints.reduce((acc, p) => acc + p.x, 0);
  const sumY = failurePoints.reduce((acc, p) => acc + p.y, 0);
  const sumXY = failurePoints.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumXX = failurePoints.reduce((acc, p) => acc + p.x * p.x, 0);

  const slope = (nFailures * sumXY - sumX * sumY) / (nFailures * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / nFailures;

  const beta = slope;
  const eta = Math.exp(-intercept / slope);
  
  // Calculate MTTF = eta * Gamma(1 + 1/beta)
  const mttf = eta * gamma(1 + 1 / beta);

  // R-Squared (on failures only)
  const meanY = sumY / nFailures;
  const ssTot = failurePoints.reduce((acc, p) => acc + Math.pow(p.y - meanY, 2), 0);
  const ssRes = failurePoints.reduce((acc, p) => {
    const estimatedY = slope * p.x + intercept;
    return acc + Math.pow(p.y - estimatedY, 2);
  }, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  // Regression Line Points (Extrapolate based on min/max time of ALL points)
  const minX = dataPoints[0].x;
  const maxX = dataPoints[n - 1].x;
  const padding = (maxX - minX) * 0.1 || 0.1;

  const lineStart = { x: minX - padding, y: slope * (minX - padding) + intercept };
  const lineEnd = { x: maxX + padding, y: slope * (maxX + padding) + intercept };

  return {
    beta,
    eta,
    mttf,
    rSquared,
    dataPoints,
    linePoints: [lineStart, lineEnd],
  };
};

// Generate points for the Probability Density Function curve
export const generatePDFPoints = (beta: number, eta: number, maxTime: number) => {
  if (beta <= 0 || eta <= 0) return [];
  
  const points = [];
  const steps = 100;
  // Start slightly above 0 to avoid division by zero errors in math
  const stepSize = maxTime / steps;
  
  for (let i = 0; i <= steps; i++) {
    const t = i * stepSize;
    if (t === 0) {
       points.push({ x: 0, y: 0 }); 
       continue;
    }
    // Weibull PDF: (beta/eta) * (t/eta)^(beta-1) * exp(-(t/eta)^beta)
    const pdf = (beta / eta) * Math.pow(t / eta, beta - 1) * Math.exp(-Math.pow(t / eta, beta));
    points.push({ x: t, y: pdf });
  }
  return points;
};