<?php
// getData.php
// 防災科研 K-NET API用 転送プロキシ

// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// 2026/5/12

// アクセス元（Origin）フィルター ＆ CORS共通処理
require_once __DIR__ . '/origin_filter.php';

// JS側から受け取るパラメータ
$cookieStr = $_GET['cookie'] ?? '';
$path = $_GET['path'] ?? ''; // 例: "eqdownload/api/eqsearch/"

if (empty($path)) {
    echo json_encode(["error" => "API path is missing."]);
    exit;
}

$BASE_URL = "https://www.kyoshin.bosai.go.jp/ja/";
$targetUrl = $BASE_URL . ltrim($path, '/'); // 先頭のスラッシュを削除して結合

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $targetUrl);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

// Django向けの厳格なヘッダー構築
$headers = array(
    "X-CSRFToken: " . ($_POST['csrfmiddlewaretoken'] ?? ''),
    "X-Requested-With: XMLHttpRequest",
    "Referer: " . $BASE_URL,
    "Cookie: " . $cookieStr
);

curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($_POST));
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    echo json_encode(["error" => "CURL Error: " . curl_error($ch)]);
} else {
    echo $response;
}

curl_close($ch);
?>