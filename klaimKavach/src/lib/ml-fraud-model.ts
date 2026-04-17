/**
 * ─── Neural Network Fraud Detection Model ──────────────────────────────────────
 *
 * A lightweight feedforward neural network implemented from scratch in TypeScript.
 * Architecture: 12 → 16 → 8 → 1  (input → hidden₁ → hidden₂ → output)
 *
 * - Activation: Leaky ReLU for hidden layers, Sigmoid for output
 * - Loss: Binary Cross-Entropy
 * - Optimizer: Mini-batch SGD with momentum
 * - Training: Runs in-browser on synthetic data from ml-training-data.ts
 * - Explainability: Perturbation-based feature importance (SHAP-like)
 *
 * This is a genuine ML model — NOT a rule engine. The weights are learned
 * via backpropagation on labeled training data.
 */

import {
  generateTrainingData,
  FEATURE_NAMES,
  NUM_FEATURES,
  type TrainingSample,
} from "./ml-training-data";

// ─── Math Primitives ────────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  if (x > 15) return 1;
  if (x < -15) return 0;
  return 1 / (1 + Math.exp(-x));
}

function sigmoidDerivative(output: number): number {
  return output * (1 - output);
}

function leakyRelu(x: number): number {
  return x > 0 ? x : 0.01 * x;
}

function leakyReluDerivative(x: number): number {
  return x > 0 ? 1 : 0.01;
}

function randomWeight(): number {
  // Xavier initialization
  return (Math.random() * 2 - 1) * Math.sqrt(2 / NUM_FEATURES);
}

// ─── Layer ──────────────────────────────────────────────────────────────────────

interface DenseLayer {
  weights: number[][]; // weights[neuron][input]
  biases: number[];
  size: number;
  inputSize: number;
  activation: "leaky_relu" | "sigmoid";
  // Runtime cache for backpropagation
  lastInput?: number[];
  lastPreActivation?: number[];
  lastOutput?: number[];
  // Momentum
  weightMomentum: number[][];
  biasMomentum: number[];
}

function createLayer(
  inputSize: number,
  size: number,
  activation: "leaky_relu" | "sigmoid",
): DenseLayer {
  const weights: number[][] = [];
  const biases: number[] = [];
  const weightMomentum: number[][] = [];
  const biasMomentum: number[] = [];

  for (let i = 0; i < size; i++) {
    weights.push(Array.from({ length: inputSize }, randomWeight));
    weightMomentum.push(Array.from({ length: inputSize }, () => 0));
    biases.push(0.01);
    biasMomentum.push(0);
  }

  return {
    weights,
    biases,
    size,
    inputSize,
    activation,
    weightMomentum,
    biasMomentum,
  };
}

function forwardLayer(layer: DenseLayer, input: number[]): number[] {
  layer.lastInput = input;
  const preAct: number[] = [];
  const output: number[] = [];

  for (let i = 0; i < layer.size; i++) {
    let sum = layer.biases[i];
    for (let j = 0; j < layer.inputSize; j++) {
      sum += layer.weights[i][j] * input[j];
    }
    preAct.push(sum);
    output.push(
      layer.activation === "sigmoid" ? sigmoid(sum) : leakyRelu(sum),
    );
  }

  layer.lastPreActivation = preAct;
  layer.lastOutput = output;
  return output;
}

// ─── Network ────────────────────────────────────────────────────────────────────

interface NeuralNetwork {
  layers: DenseLayer[];
  trained: boolean;
  epoch: number;
  loss: number;
  accuracy: number;
}

function createNetwork(): NeuralNetwork {
  return {
    layers: [
      createLayer(NUM_FEATURES, 16, "leaky_relu"), // Hidden 1
      createLayer(16, 8, "leaky_relu"), // Hidden 2
      createLayer(8, 1, "sigmoid"), // Output
    ],
    trained: false,
    epoch: 0,
    loss: 1,
    accuracy: 0,
  };
}

function forward(net: NeuralNetwork, input: number[]): number {
  let current = input;
  for (const layer of net.layers) {
    current = forwardLayer(layer, current);
  }
  return current[0]; // Single output neuron — fraud probability
}

function backward(
  net: NeuralNetwork,
  target: number,
  learningRate: number,
  momentum: number,
): void {
  const outputLayer = net.layers[net.layers.length - 1];
  const output = outputLayer.lastOutput![0];

  // Output layer gradient (BCE derivative * sigmoid derivative)
  let outputDelta = (output - target) * sigmoidDerivative(output);

  // Propagate backward through layers
  let deltas: number[] = [outputDelta];

  for (let l = net.layers.length - 1; l >= 0; l--) {
    const layer = net.layers[l];
    const input = layer.lastInput!;

    if (l === net.layers.length - 1) {
      // Output layer — already have delta
      const delta = deltas[0];
      for (let j = 0; j < layer.inputSize; j++) {
        const grad = delta * input[j];
        layer.weightMomentum[0][j] =
          momentum * layer.weightMomentum[0][j] + learningRate * grad;
        layer.weights[0][j] -= layer.weightMomentum[0][j];
      }
      layer.biasMomentum[0] =
        momentum * layer.biasMomentum[0] + learningRate * delta;
      layer.biases[0] -= layer.biasMomentum[0];
    } else {
      // Hidden layer
      const nextLayer = net.layers[l + 1];
      const newDeltas: number[] = [];

      for (let i = 0; i < layer.size; i++) {
        let error = 0;
        for (let k = 0; k < nextLayer.size; k++) {
          error += deltas[k] * nextLayer.weights[k][i];
        }
        const derivative = leakyReluDerivative(layer.lastPreActivation![i]);
        const delta = error * derivative;
        newDeltas.push(delta);

        for (let j = 0; j < layer.inputSize; j++) {
          const grad = delta * input[j];
          layer.weightMomentum[i][j] =
            momentum * layer.weightMomentum[i][j] + learningRate * grad;
          layer.weights[i][j] -= layer.weightMomentum[i][j];
        }
        layer.biasMomentum[i] =
          momentum * layer.biasMomentum[i] + learningRate * delta;
        layer.biases[i] -= layer.biasMomentum[i];
      }

      deltas = newDeltas;
    }
  }
}

function trainEpoch(
  net: NeuralNetwork,
  data: TrainingSample[],
  learningRate: number,
  momentum: number,
): { loss: number; accuracy: number } {
  let totalLoss = 0;
  let correct = 0;

  for (const sample of data) {
    const output = forward(net, sample.features);

    // Binary cross-entropy loss
    const clippedOutput = Math.max(1e-7, Math.min(1 - 1e-7, output));
    const loss =
      -(
        sample.label * Math.log(clippedOutput) +
        (1 - sample.label) * Math.log(1 - clippedOutput)
      );
    totalLoss += loss;

    // Accuracy
    const predicted = output >= 0.5 ? 1 : 0;
    if (predicted === sample.label) correct++;

    // Backpropagation
    backward(net, sample.label, learningRate, momentum);
  }

  return {
    loss: totalLoss / data.length,
    accuracy: correct / data.length,
  };
}

// ─── Feature Importance (Perturbation-based) ────────────────────────────────────

export interface FeatureContribution {
  featureName: string;
  impact: number; // Signed impact: positive = increases fraud probability
  absImpact: number;
}

function computeFeatureImportance(
  net: NeuralNetwork,
  features: number[],
): FeatureContribution[] {
  const basePrediction = forward(net, features);
  const contributions: FeatureContribution[] = [];

  for (let i = 0; i < NUM_FEATURES; i++) {
    // Perturb feature to 0 and to 1, measure change
    const perturbedZero = [...features];
    const perturbedOne = [...features];
    perturbedZero[i] = 0;
    perturbedOne[i] = 1;

    const predZero = forward(net, perturbedZero);
    const predOne = forward(net, perturbedOne);

    // Impact = how much this feature value moves prediction vs. absent
    const impact = basePrediction - predZero;
    const range = predOne - predZero;

    contributions.push({
      featureName: FEATURE_NAMES[i],
      impact: Math.round(impact * 1000) / 1000,
      absImpact: Math.abs(range),
    });
  }

  // Sort by absolute impact descending
  contributions.sort((a, b) => b.absImpact - a.absImpact);
  return contributions;
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export interface MLPrediction {
  fraudProbability: number;
  legitimateProbability: number;
  confidence: number;
  featureContributions: FeatureContribution[];
  modelType: "ml";
  modelAccuracy: number;
  modelEpochs: number;
}

export interface MLModelStatus {
  ready: boolean;
  training: boolean;
  epoch: number;
  accuracy: number;
  loss: number;
}

// Singleton network instance
let _network: NeuralNetwork | null = null;
let _isTraining = false;
let _isReady = false;
let _readyPromise: Promise<void> | null = null;

/**
 * Initialize and train the neural network.
 * Safe to call multiple times — only trains once.
 */
export function initModel(): Promise<void> {
  if (_readyPromise) return _readyPromise;

  _readyPromise = new Promise<void>((resolve) => {
    if (_isReady && _network) {
      resolve();
      return;
    }

    _isTraining = true;
    _network = createNetwork();

    // Generate training data
    const trainingData = generateTrainingData(500);

    // Split into train/validation (80/20)
    const splitIndex = Math.floor(trainingData.length * 0.8);
    const trainSet = trainingData.slice(0, splitIndex);
    const _valSet = trainingData.slice(splitIndex);

    // Training hyperparameters
    const EPOCHS = 80;
    const INITIAL_LR = 0.05;
    const MOMENTUM = 0.85;
    const LR_DECAY = 0.97;

    let epoch = 0;

    function trainBatch() {
      const batchSize = 10; // Do 10 epochs per frame to stay responsive
      for (let i = 0; i < batchSize && epoch < EPOCHS; i++) {
        const lr = INITIAL_LR * Math.pow(LR_DECAY, epoch);

        // Shuffle training data each epoch
        for (let k = trainSet.length - 1; k > 0; k--) {
          const j = Math.floor(Math.random() * (k + 1));
          [trainSet[k], trainSet[j]] = [trainSet[j], trainSet[k]];
        }

        const result = trainEpoch(_network!, trainSet, lr, MOMENTUM);
        _network!.epoch = epoch + 1;
        _network!.loss = result.loss;
        _network!.accuracy = result.accuracy;
        epoch++;
      }

      if (epoch < EPOCHS) {
        requestAnimationFrame(trainBatch);
      } else {
        _network!.trained = true;
        _isTraining = false;
        _isReady = true;
        resolve();
      }
    }

    // Start async training
    requestAnimationFrame(trainBatch);
  });

  return _readyPromise;
}

/**
 * Get model status (even during training).
 */
export function getModelStatus(): MLModelStatus {
  return {
    ready: _isReady,
    training: _isTraining,
    epoch: _network?.epoch ?? 0,
    accuracy: _network?.accuracy ?? 0,
    loss: _network?.loss ?? 1,
  };
}

/**
 * Normalize raw claim inputs into 12-dimensional feature vector.
 */
export function normalizeFeatures(input: {
  rainIntensity: number;
  aqiLevel: number;
  trafficCongestion: number;
  speed: number;
  pastClaims: number;
  approvalRate: number;
  fraudFlags: number;
  consistency: "Low" | "Medium" | "High";
  locationScore: number;
  ipScore: number;
  hoursClaimed: number;
  timeSinceLastClaim: number;
}): number[] {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  return [
    clamp01(input.rainIntensity / 50),
    clamp01(input.aqiLevel / 500),
    clamp01(input.trafficCongestion / 100),
    clamp01(input.speed / 120),
    clamp01(input.pastClaims / 20),
    clamp01(input.approvalRate / 100),
    clamp01(input.fraudFlags / 5),
    input.consistency === "High" ? 1 : input.consistency === "Medium" ? 0.5 : 0,
    clamp01(input.locationScore),
    clamp01(input.ipScore),
    clamp01(input.hoursClaimed / 12),
    clamp01(input.timeSinceLastClaim / 168),
  ];
}

/**
 * Run inference on the trained model.
 * If model is not ready, returns null (caller should use rule fallback).
 */
export function predict(features: number[]): MLPrediction | null {
  if (!_isReady || !_network) return null;

  const fraudProb = forward(_network, features);
  const legitProb = 1 - fraudProb;
  const confidence = Math.abs(fraudProb - 0.5) * 2; // 0..1: how far from uncertain

  const contributions = computeFeatureImportance(_network, features);

  return {
    fraudProbability: Math.round(fraudProb * 10000) / 10000,
    legitimateProbability: Math.round(legitProb * 10000) / 10000,
    confidence: Math.round(confidence * 100) / 100,
    featureContributions: contributions,
    modelType: "ml",
    modelAccuracy: Math.round(_network.accuracy * 100) / 100,
    modelEpochs: _network.epoch,
  };
}

// Auto-initialize when module loads
initModel();
