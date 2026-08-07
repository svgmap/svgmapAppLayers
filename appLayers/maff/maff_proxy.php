<?php
/**
 * eMAFF WFS的APIエンドポイント 利用プロキシ
 * クライアント(LaWA)からBBoxやパラメータを受け取り、ヘッダを構築してMAFFに転送しする
 */

// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.


// アクセス元（Origin）フィルター ＆ CORS共通処理
require_once __DIR__ . '/origin_filter.php';

// ターゲットとなるeMAFFのWFS的エンドポイント
$target_url = "https://map-internal.api.maff.go.jp/mobileapi/getBasicLayerGeometry";

// フロントエンド(LaWA)から送られてきたJSONペイロードをそのまま取得
$json_payload = file_get_contents('php://input');

// cURLの初期化
$ch = curl_init($target_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $json_payload);

// OriginとRefererを設定する
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Content-Type: application/json',
    'Origin: https://map.maff.go.jp',
    'Referer: https://map.maff.go.jp/',
    'Authorization: undefined', 
    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
));

// gzip等で圧縮されたレスポンスを自動解凍する
curl_setopt($ch, CURLOPT_ENCODING, "");

// リクエスト実行
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

// MAFFから返ってきたHTTPステータスコードをそのままクライアントに返す
http_response_code($http_code);

if(curl_errno($ch)){
    // 通信エラー時のハンドリング
    echo json_encode(['error' => curl_error($ch)]);
} else {
    // 成功時：JSONをフロントエンドにそのまま返却
    echo $response;
}

curl_close($ch);
?>