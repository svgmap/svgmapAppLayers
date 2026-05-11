// tests/VectorWorker.test.js
import VectorWorker from '../appLayers/layer-recommender/VectorWorker.js';

describe('VectorWorker', () => {
  test('should transform text to vector', async () => {
    const worker = new VectorWorker();
    const result = await worker.transform('sample text');
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
