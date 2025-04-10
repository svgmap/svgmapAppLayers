<?php
// Description:
// fileManege.php
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// based on 
// https://manablog.org/php_form_log/
// https://www.php.net/manual/ja/function.file-put-contents.php
//
// History
// 2023/6/15 update sync function, add remove request
// 2024/04/16  add lock,  support ziip(binary),  filename ( overwrite only )

$contentDir = "contents/";
$indexFile = 'index.txt';

function lock($lock='./foo.lock'){
    if (!$fp=fopen($lock, "a")) return false;

    flock($fp, LOCK_EX);

    return $fp;
}



function getFilePathArray( $contentDir ){
  $clist = glob( $contentDir . "{*.svg,*.csv,*.json,*.geojson,*.zip}", GLOB_BRACE ); // */
  //echo "getFilePathArray:";
  //print_r( $clist);
  $pathHash = array();
  foreach( $clist as $path ){
    //echo $path;
    $pathHash[basename($path)] = true;
  }
  
  return $pathHash;
}

function getFnames( $fpath , $contentDir ){
  // 実際に存在するsvgファイル名の連想配列
  $currentList = getFilePathArray( $contentDir );
  if (($handle = fopen($fpath, "r")) !== FALSE) {
    flock($handle, LOCK_EX);
    // index.txtからK:ファイル名,V:諸々の連想配列をつくる
    $indexTxtFileNameArray = array();
    setlocale(LC_ALL,'ja_JP.UTF-8'); // 2byte chr fix for fgetcsv issue
    // 1行ずつfgetcsv()関数を使って読み込んで連想配列をつくる
    while (($data = fgetcsv($handle))) {
      $indexTxtFileNameArray[$data[0]]=$data;
    }
    
    // 実際に存在するsvgファイルについて、index.txtを上書きすべきcsvを作成する
    $validateCsv;
    foreach($currentList as $fname => $existence){
      if( isset($indexTxtFileNameArray[ $fname ] )){
        // index.txtにレコードがあるもの
        $data = $indexTxtFileNameArray[ $fname ];
        $validateCsv .= $data[0] . "," . $data[1] . "," . $data[2] . "\n";
      } else {
        // ないものは、ちょっと適当に作っていく
       date_default_timezone_set('Asia/Tokyo');
       $time = date("YmdHis");
        $validateCsv .= $fname . ", " . $time . ", " . "content_" . $time . "\n";
      }
    }
    //echo "<pre>". $validateCsv . "</pre>";
    fclose($handle);
    return $validateCsv;
  }  
}

$lock=lock();

if( isset($_POST['title'])){
  $title = $_POST['title'];
  $title =  htmlspecialchars ($title);
  $title = str_replace(array("\r\n", "\r", "\n" , "." , "," , "/"  ), '', $title);
  
  $ftype="svg";
  if(isset($_POST['type'])){
    if ( strcmp($_POST['type'], "png") == 0 ) {
      $ftype="png";
    } else if ( strcmp($_POST['type'], "svg") == 0 ) {
      $ftype="svg";
    } else if ( strcmp($_POST['type'], "zip") == 0 ) {
      $ftype="zip";
    } else if ( strcmp($_POST['type'], "json") == 0 ) {
      $ftype="json";
    } else if ( strcmp($_POST['type'], "geojson") == 0 ) {
      $ftype="geojson";
    } else if ( strcmp($_POST['type'], "csv") == 0 ) {
      $ftype="csv";
    }
  }
  
  date_default_timezone_set('Asia/Tokyo');
  $time = date("YmdHis"); 
  if(isset($_POST['filename'])){
    $contentFile = $_POST['filename'];
    $contentFile =  htmlspecialchars ($contentFile);
    $contentFile = str_replace(array("\r\n", "\r", "\n" , "." , "," , "/" , "*" , "?" , "[" , "]" , "^" , "$"  ), '', $contentFile);
    $contentFile = $contentFile . "." . $ftype;
  } else {
    $contentFile = $time . "_" . mt_rand() . "." . $ftype;
  }
  $write = $contentFile . ", " . $time . ", ". $title ;
  
  // echo $write;
  
  //$current = file_get_contents($indexFile);
  
  $current = getFnames($indexFile , $contentDir);
  $current .= $write . "\n";
  
  echo $current;
  
  file_put_contents($indexFile, $current, LOCK_EX);
  
  $success = false;
  if ( $ftype=="zip"){
    $uploadFile = $contentDir . $contentFile;
    $success = move_uploaded_file($_FILES['svgmapdata']['tmp_name'], $uploadFile);
  } else if (isset($_POST['svgmapdata']) ){
    $content = $_POST['svgmapdata'];
    file_put_contents( $contentDir . $contentFile, $content, LOCK_EX);
  }
  
  if ( !$success ){
    echo "Upload Operation ERROR..." ;
  }
  
} elseif (isset($_GET["sync"])) {
  $current = getFnames($indexFile , $contentDir);
  file_put_contents($indexFile, $current, LOCK_EX);
  echo "sync completed" ;
} elseif (isset($_GET["remove"])) {
  $fileName = $_GET["remove"];
  $fileName = str_replace(array("\r\n", "\r", "\n" , "," , "*" , "?" , "[" , "]" , "^" , "$" ), '', $fileName);
  $fileName = basename($fileName);
  if (unlink($contentDir . $fileName)){
    $current = getFnames($indexFile , $contentDir);
    file_put_contents($indexFile, $current, LOCK_EX);
    echo "Success to remove " . $fileName;
  }else{
    echo "Fail to remove " . $fileName;
  }
} else {
  echo "Operation ERROR..." ;
}

fclose($lock);
?>