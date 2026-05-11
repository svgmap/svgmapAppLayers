// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { TransformerEngine } from './TransformerEngine.js';
import VectorStore from './VectorStore.js';

export default class VectorRecommender {
  constructor() {
    this.engine = new TransformerEngine();
    this.store = new VectorStore();
  }

  async initializeFromLayerList(layers) {
    await this.engine.init(); // Engineの明示的初期化
    for (const layer of layers) {
      // レイヤーのタイトルをベクトル化して保存
      const vector = await this.engine.embed(layer.title || layer.id);
      const dataToSave = { 
        id: layer.id, 
        vector: Array.from(vector), 
        title: layer.title || layer.id 
      };
      console.log('Saving to store:', dataToSave); // ログを追加
      await this.store.save(dataToSave);
    }
  }

  async getTop5Recommendations(query) {
    const queryVector = await this.engine.embed(query);
    
    // 全レイヤーをストアから取得
    const db = await this.store._getDB();
    const allLayers = await new Promise((resolve) => {
      const tx = db.transaction(this.store.storeName, 'readonly');
      const request = tx.objectStore(this.store.storeName).getAll();
      request.onsuccess = () => resolve(request.result);
    });

    // コサイン類似度で類似度計算とフィルタリング（0.7以上、かつ自分自身を除外）
    return allLayers
      .filter(layer => typeof layerID === 'undefined' || layer.id !== layerID) 
      .map(layer => ({
        id: layer.id,
        title: layer.title,
        score: this._dotProduct(queryVector, layer.vector)
      }))
      .filter(item => item.score >= 0.7)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  // ベクトルの内積を計算するヘルパー関数
  _dotProduct(vecA, vecB) {
    let product = 0;
    for (let i = 0; i < vecA.length; i++) {
      product += vecA[i] * vecB[i];
    }
    return product;
  }
}
