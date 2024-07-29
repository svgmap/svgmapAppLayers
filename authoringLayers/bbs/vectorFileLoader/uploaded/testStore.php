<?php
// https://manablog.org/php_form_log/
// https://www.php.net/manual/ja/function.file-put-contents.php

$contentDir = "contents/";
$indexFile = 'index.txt';

function getFilePathArray( $contentDir ){
  $clist = glob( $contentDir . "*" ); // */
  //echo "getFilePathArray:";
  //print_r( $clist);
  $pathHash = array();
  foreach( $clist as $path ){
    //echo $path;
    $pathHash[$path] = true;
  }
  
  return $pathHash;
}

function getFnames( $fpath , $contentDir ){
  $currentList = getFilePathArray( $contentDir );
  if (($handle = fopen($fpath, "r")) !== FALSE) {
    // 1行ずつfgetcsv()関数を使って読み込む
    // $fpaths = array();
    $validateCsv;
    setlocale(LC_ALL,'ja_JP.UTF-8'); // 2byte chr fix for fgetcsv issue
    while (($data = fgetcsv($handle))) {
      // array_push($fpaths, $contentDir . $data[0]);
      if ( isset($currentList[ $contentDir . $data[0] ] )){
        //echo "IS\n";
        // array_push( $fpaths , $data[0] . "," . $data[1] . "," . $data[2] . "\n" );
         $validateCsv .= $data[0] . "," . $data[1] . "," . $data[2] . "\n";
      } else {
        //echo "NOT\n";
      }
    }
//    echo "fpaths:";
//    print_r( $fpaths);
//    echo $validateCsv;
    fclose($handle);
    return $validateCsv;
  }  
}

if(isset($_POST['svgmapdata']) && isset($_POST['title'])){
  $content = $_POST['svgmapdata'];
  $title = $_POST['title'];
  $title =  htmlspecialchars ($title);
  $title = str_replace(array("\r\n", "\r", "\n" , "." , "," , "/" ), '', $title);
  
  date_default_timezone_set('Asia/Tokyo');
  $time = date("YmdHis"); 
  $contentFile = $time . "_" . mt_rand() . ".svg";
  $write = $contentFile . ", " . $time . ", ". $title ;
  
  // echo $write;
  
  //$current = file_get_contents($indexFile);
  
  $current = getFnames($indexFile , $contentDir);
  
  
  
  $current .= $write . "\n";
  
  echo "\n" . $current;
  
  file_put_contents($indexFile, $current, LOCK_EX);
  
  file_put_contents( $contentDir . $contentFile, $content, LOCK_EX);
  
  
} elseif (isset($_GET["sync"])) {
  $current = getFnames($indexFile , $contentDir);
  file_put_contents($indexFile, $current, LOCK_EX);
  echo "sync completed" ;
} else {
  echo "ERROR..." ;
}
?>