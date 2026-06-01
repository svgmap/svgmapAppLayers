<?php
// origin_filter.php
// アクセス元（Origin/Referer）制限 ＆ CORS共通処理モジュール
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// 許可するドメインのリスト(書き換えてください)
// ※ wwwの有無や特定のサブドメインを許容するため、ドメイン本体（ルートドメイン）を記述します。
$allowed_origins = [
    'svgmap.org'
];

// PHP 8.0 未満のための互換関数
if (!function_exists('str_ends_with')) {
    function str_ends_with($haystack, $needle) {
        return $needle === '' || substr($haystack, -strlen($needle)) === $needle;
    }
}

// 現代のブラウザ（Ajax/fetch）が送ってくる ORIGIN を最優先、
// 念のため REFERER もチェックし、どちらも無ければ空にする（＝直叩きは弾く）
$client_url = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$is_allowed = false;
$allow_origin_header = '';

if (!empty($client_url)) {
    // URLからホスト名（ドメイン部分）のみを抽出
    $referer_host = parse_url($client_url, PHP_URL_HOST);
    
    foreach ($allowed_origins as $domain) {
        // 完全一致、または後方一致（.svgmap.org で終わる）をチェック
        if ($referer_host === $domain || str_ends_with($referer_host, '.' . $domain)) {
            $is_allowed = true;
            // 許可された場合、CORS応答ヘッダ用にアクセス元の完全なオリジン（http://... や https://...）を記録
            $allow_origin_header = $_SERVER['HTTP_ORIGIN'] ?? (parse_url($client_url, PHP_URL_SCHEME) . '://' . $referer_host);
            break;
        }
    }
}

// 許可されていない、または直接叩かれた（空っぽ）場合は、403 Forbidden で即座に終了
if (!$is_allowed) {
    header('HTTP/1.1 403 Forbidden');
    header('Content-Type: application/json; charset=utf-8');
    exit(json_encode(["error" => "Access Denied: Invalid Origin/Referer"]));
}

// ------------------------------------------------
// 制限をクリアしたアクセスにのみ、共通のCORSヘッダーを出力
// ------------------------------------------------
header("Access-Control-Allow-Origin: " . $allow_origin_header);
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

// プリフライト（OPTIONSメソッド）の場合は、メイン処理（CURLなど）を実行させずにここで終了する
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}
?>