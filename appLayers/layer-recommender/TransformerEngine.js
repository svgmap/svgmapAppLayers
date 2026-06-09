// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0';

export class TransformerEngine {
    constructor() {
        this.pipe = null;
        this.isProcessing = false;
        this.queue = [];
    }

    // ベクトル検索用のTransformerモデルを初期化する関数
    async init(task = 'feature-extraction', model = 'Xenova/multilingual-e5-small') { // Xenova/all-MiniLM-L6-v2よりXenova/multilingual-e5-smallの方が日本語に強い
        if (this.pipe) return;

        try {
            env.allowLocalModels = false;
            this.pipe = await pipeline(task, model, {
                dtype: 'fp16',
                device: 'webgpu'
            });
            console.log('Transformer Engine initialized');
        } catch (e) {
            console.warn('WebGPU failed, falling back to WASM:', e);
            this.pipe = await pipeline(task, model, {
                dtype: 'fp16',
                device: 'wasm'
            });
        }
    }

    async embed(text) {
        if (!this.pipe) await this.init();
        
        // 処理中の場合はキューに追加して順番に処理する
        if (this.isProcessing) {
            await new Promise(resolve => this.queue.push(resolve));
        }
        
        this.isProcessing = true;
        
        try {
            // ベクトルを平均プーリングして正規化するオプションを追加
            const result = await this.pipe(text, { pooling: 'mean', normalize: true }); 
            return result.data;
        } finally {
            this.isProcessing = false;

            // キューに次の処理があれば実行
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                next();
            }
        }
    }
}
