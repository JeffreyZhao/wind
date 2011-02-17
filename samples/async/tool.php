<?php

if (array_key_exists("s", $_GET)) {
    sleep($_GET["s"]);
}

if (array_key_exists("m", $_GET)) {
    print($_GET["m"]);
}

if (array_key_exists("b", $_GET)) {
    $fp = fopen("books/" . abs($_GET["b"] % 3) . ".txt", 'r');
    $c = "";
    while(!feof($fp)){
        $c .= fgets($fp, 4096);
    }
    fclose($fp);
    print $c;    
}
?>
