// tests/VectorStore.test.js
import VectorStore from '../appLayers/layer-recommender/VectorStore.js';

describe('VectorStore', () => {
  let store;
  beforeEach(() => {
    store = new VectorStore();
  });

  test('should save and retrieve a vector embedding', async () => {
    const layer = { id: 'test-layer', vector: new Float32Array([0.1, 0.2, 0.3]) };
    await store.save(layer);
    const retrieved = await store.get('test-layer');
    expect(retrieved.vector).toEqual(layer.vector);
  });
});
