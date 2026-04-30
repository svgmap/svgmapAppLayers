<?php
// Yahoo!ジオコーダAPI用のProxyサービス

// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.


// https://developer.yahoo.co.jp/webapi/map/openlocalplatform/v1/geocoder.html

// Notes:
// PHP 8.0+ 推奨
// [ClientID] を Yahoo! の管理画面で発行した ID に書き換える
// $allowed_origins に自分のサイトのドメインを書き入れる

// Yahoo! APIの設定
$appId = '[ClientID]'; // YahooのClientIDを設定 (https://e.developer.yahoo.co.jp/dashboard)
$endpoint = 'https://map.yahooapis.jp/geocode/V1/geoCoder';

// 許可ドメインのリスト
// wwwの有無やサブドメインを許容するため、ドメイン本体を記述
$allowed_origins = [
    '[Allowed_origi1]',
    '[Allowed_origi2]'
];

// PHP 8.0 未満のための互換関数
if (!function_exists('str_ends_with')) {
    function str_ends_with($haystack, $needle) {
        return $needle === '' || substr($haystack, -strlen($needle)) === $needle;
    }
}

// 簡易リファラー制限
$referer = $_SERVER['HTTP_REFERER'] ?? '';
$is_allowed = false;

if (!empty($referer)) {
    // リファラーからホスト名部分のみを抽出（例: https://www.example.com/path -> www.example.com）
    $referer_host = parse_url($referer, PHP_URL_HOST);

    foreach ($allowed_origins as $domain) {
        // 後方一致でチェック（wwwあり/なし、特定のサブドメインを許容）
        if ($referer_host === $domain || str_ends_with($referer_host, '.' . $domain)) {
            $is_allowed = true;
            break;
        }
    }
}

if (!$is_allowed) {
    header('HTTP/1.1 403 Forbidden');
    exit('Access Denied: Invalid Referer');
}

// クエリパラメータの処理 ---
// ブラウザから送られてきた全てのクエリを取得
$params = $_GET;

// ClientIDをサーバー側のものに強制置換（上書き）
$params['appid'] = $appId;

// outputが未指定ならデフォルトでjsonにする（JS側で楽するため）
if (!isset($params['output'])) {
    $params['output'] = 'json';
}

// 転送実行
$url = $endpoint . '?' . http_build_query($params);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10); // 念のためタイムアウト設定

$response = curl_exec($ch);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

curl_close($ch);

// レスポンスをそのまま返す
header("Content-Type: $contentType");
echo $response;