<?php
session_start();
include 'db.php';

if (!empty($_SESSION['cart'])) {
    foreach ($_SESSION['cart'] as $id => $quantity) {
        $sql = "SELECT * FROM products WHERE id=$id";
        $result = $conn->query($sql);
        $row = $result->fetch_assoc();
        $total = $row['price'] * $quantity;
        $orderSql = "INSERT INTO orders (product_id, quantity, total_price) VALUES ($id, $quantity, $total)";
        $conn->query($orderSql);
    }

    // Clear the cart after placing the order
    $_SESSION['cart'] = array();
    $message = "Order placed successfully!";
} else {
    $message = "Your cart is empty.";
}

$conn->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>Order Confirmation</h1>
    </header>

    <main>
        <p><?php echo $message; ?></p>
        <a href="index.php">Go back to shopping</a>
    </main>
</body>
</html>
