<?php
/**
 * PREPROS PHP HELPER
 * Allows automatic refresh when saving PHP files.
 *
 * Requires Prepros to be installed on your system.
 * Must be used before any content is output (ie, functions.php).
 *
 * @link https://gist.github.com/Web1776/9233725
*/


$lastModified=filemtime(__FILE__);
header("Last-Modified: ".gmdate("D, d M Y H:i:s", $lastModified)." GMT");

?>
