<?php
// getTokens.php
// 防災科研 K-NET CSRF対応php

// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// 2026/5/12

// アクセス元（Origin）フィルター ＆ CORS共通処理
require_once __DIR__ . '/origin_filter.php';

$BASE_URL = "https://www.kyoshin.bosai.go.jp/ja/eqdownload/";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $BASE_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
$response = curl_exec($ch);
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$header = substr($response, 0, $header_size);
$body = substr($response, $header_size);
curl_close($ch);

// token1: HTMLから抽出
preg_match('/name="csrfmiddlewaretoken"\s+value="([^"]+)"/', $body, $matches);
$token1 = $matches[1] ?? '';

// token2: Cookieから抽出
preg_match_all('/^Set-Cookie:\s*([^;]*)/mi', $header, $matches);
$cookies = array();
foreach($matches[1] as $item) {
    parse_str($item, $cookie);
    $cookies = array_merge($cookies, $cookie);
}
$token2 = isset($cookies['csrftoken']) ? "csrftoken=" . $cookies['csrftoken'] : "";

// マージしてJSONで返す
echo json_encode(array(
    "token1" => $token1,
    "token2" => $token2
));
?>