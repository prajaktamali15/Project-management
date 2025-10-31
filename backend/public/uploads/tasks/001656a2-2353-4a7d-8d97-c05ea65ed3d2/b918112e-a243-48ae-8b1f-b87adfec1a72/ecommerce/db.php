<?php
// db.php: Database connection file

$host = 'localhost';
$user = 'root';
$password = '';
$dbname = 'ecommerce';

// Create connection
$conn = new mysqli($host, $user, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>
