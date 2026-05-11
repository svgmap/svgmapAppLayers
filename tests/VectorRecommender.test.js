// tests/VectorRecommender.test.js
import VectorRecommender from '../appLayers/layer-recommender/VectorRecommender.js';

describe('VectorRecommender', () => {
  let recommender;
  beforeEach(() => {
    recommender = new VectorRecommender();
  });

  test('should return top 3 recommendations', async () => {
    // モックデータ準備: 初期化処理をシミュレート
    const layers = [
      { id: '1', name: '防災マップ' },
      { id: '2', name: '避難所情報' },
      { id: '3', name: '気象データ' },
      { id: '4', name: '地質図' }
    ];
    await recommender.initializeFromLayerList(layers);
    
    // 推奨取得
    const results = await recommender.getTop3Recommendations('防災に関するレイヤー');
    expect(results).toHaveLength(3);
    expect(results[0]).toHaveProperty('id');
  });
});
